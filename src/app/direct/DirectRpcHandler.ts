/// <reference types="debug" />
const debug: debug.IDebugger = require('debug')('mcft:svccom:ExpressRpcHandler')

import * as http from 'http'

import * as express from 'express'
// import * as bodyParser from 'body-parser'
// import * as shortid from 'shortid';
import { injectable, Guard, CriticalException } from '@micro-fleet/common'

import * as rpc from '../RpcCommon'


export interface IDirectRpcHandler extends rpc.IRpcHandler {
    /**
     * Http ports to listen
     */
    port: number

}

@injectable()
export class ExpressRpcHandler
            extends rpc.RpcHandlerBase
            implements IDirectRpcHandler {

    private static URL_TESTER: RegExp = (function() {
            const regexp = new RegExp(/^[a-zA-Z0-9_-]*$/)
            regexp.compile()
            return regexp
        })()


    private _server: http.Server
    private _app: express.Express
    private _port: number
    private _routers: Map<string, express.Router>
    private _isOpen: boolean


    constructor() {
        super()
        this._port = 30000
        this._isOpen = false
    }


    public get port(): number {
        return this._port
    }

    public set port(val: number) {
        if (val > 0 && val <= 65535) {
            this._port = val
            return
        }
        throw new CriticalException('INVALID_PORT_DIRECT_RPC_HANDLER')
    }

    /**
     * @see IDirectRpcHandler.init
     */
    public init(params?: any): any {
        Guard.assertIsFalsey(this._routers, 'This RPC Handler is already initialized!')
        Guard.assertIsTruthy(this.name, '`name` property must be set!')

        // this._instanceUid = shortid.generate();
        let app: express.Express
        app = this._app = express()

        app.disable('x-powered-by')
        app.use((req, res, next) => {
            // When `deadLetter()` is called, prevent all new requests.
            if (!this._isOpen) {
                return res.sendStatus(410) // Gone, https://httpstatuses.com/410
            }
            return next()
        })
        app.use(express.json()) // Parse JSON in POST request

        this._routers = new Map<string, express.Router>()
    }

    /**
     * @see IRpcHandler.start
     */
    public start(): Promise<void> {
        return new Promise<void>(resolve => {
            this._server = this._app.listen(this._port, () => {
                debug(`Listening port ${this._port}`)
                this._isOpen = true
                resolve()
            })
            this._server.on('error', err => this.emitError(err))
        })
    }

    /**
     * @see IRpcHandler.pause
     */
    public pause(): void {
        this._isOpen = false
    }

    /**
     * @see IRpcHandler.resume
     */
    public resume(): void {
        this._isOpen = true
    }

    /**
     * @see IRpcHandler.dispose
     */
    public dispose(): Promise<void> {
        return new Promise<void>((resolve) => {
            if (!this._server) {
                return resolve()
            }
            this._server.close(() => {
                this._server = null
                resolve()
            })
        })
    }

    /**
     * @see IRpcHandler.handle
     */
    public handle(moduleName: string, actionName: string, handler: rpc.RpcHandlerFunction): void {
        Guard.assertIsDefined(this._routers, '`init` method must be called first!')
        Guard.assertIsMatch(ExpressRpcHandler.URL_TESTER, moduleName, `Module name "${moduleName}" is not URL-safe!`)
        Guard.assertIsMatch(ExpressRpcHandler.URL_TESTER, actionName, `Action name "${actionName}" is not URL-safe!`)

        let router: express.Router
        if (this._routers.has(moduleName)) {
            router = this._routers.get(moduleName)
        } else {
            router = express.Router()
            this._routers.set(moduleName, router)
            this._app.use(`/${moduleName}`, router)
            debug(`Created router for module: ${moduleName}`)
        }
        router.post(`/${actionName}`, this.wrapHandler(handler))
        debug(`Register action: ${actionName} to module ${moduleName}`)
    }


    private wrapHandler(handler: rpc.RpcHandlerFunction): express.RequestHandler {
        return (req: express.Request, res: express.Response, next: express.NextFunction): void => {
            // const actionName = req.url.match(/[^\/]+$/)[0];
            const request: rpc.RpcRequest = req.body;

            (new Promise((resolve, reject) => {
                const wrappedReject = (isIntended: boolean) => (reason: any) => reject(<rpc.HandlerRejection>{
                    isIntended,
                    reason,
                })

                try {
                    const output: any = handler({
                        payload: request.payload,
                        resolve,
                        reject: wrappedReject(true),
                        rpcRequest: request,
                        rawMessage: req,
                    })
                    if (output && typeof output.catch === 'function') {
                        output.catch(wrappedReject(false)) // Catch async exceptions.
                    }
                } catch (err) { // Catch normal exceptions.
                    wrappedReject(false)(err)
                }
            }))
            .then(result => {
                res.status(200).send(this.createResponse(true, result, request.from))
            })
            .catch((error: rpc.HandlerRejection) => {
                const errObj = this.createError(error)
                res.status(500).send(this.createResponse(false, errObj, request.from))
            })
            // Catch error thrown by `createError()`
            .catch(this.emitError.bind(this))
        }
    }
}
