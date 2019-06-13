/// <reference types="debug" />
const debug: debug.IDebugger = require('debug')('mcft:svccom:HttpRpcCaller')

import * as request from 'request-promise'
import { injectable, Guard } from '@micro-fleet/common'

import * as rpc from '../RpcCommon'


export interface IDirectRpcCaller extends rpc.IRpcCaller {
    /**
     * IP address or host name including port number.
     * Do not include protocol (http, ftp...) because different class implementations
     * will prepend different protocols.
     */
    baseAddress: string
}

@injectable()
export class HttpRpcCaller
            extends rpc.RpcCallerBase
            implements IDirectRpcCaller {

    private _baseAddress: string
    private _requestMaker: (options: any) => Promise<any>

    constructor() {
        super()
        this._requestMaker = <any>request
    }

    public get baseAddress(): string {
        return this._baseAddress
    }

    public set baseAddress(val: string) {
        this._baseAddress = val
    }


    /**
     * @see IRpcCaller.init
     */
    public init(param?: any): void {
        // Empty
    }

    /**
     * @see IRpcCaller.dispose
     */
    public async dispose(): Promise<void> {
        await super.dispose()
        this._requestMaker = null
    }

    /**
     * @see IRpcCaller.call
     */
    public call(moduleName: string, action: string, params?: any): Promise<rpc.RpcResponse> {
        Guard.assertArgDefined('moduleName', moduleName)
        Guard.assertArgDefined('action', action)
        Guard.assertIsDefined(this._baseAddress, 'Base URL must be set!')

        const uri = `http://${this._baseAddress}/${moduleName}/${action}`
        debug(`Calling: ${uri}`)
        const rpcRequest: rpc.RpcRequest = {
                from: this.name,
                to: moduleName,
                payload: params,
            },
            options: request.Options = {
                method: 'POST',
                uri,
                body: rpcRequest,
                json: true, // Automatically stringifies the body to JSON
                timeout: this.timeout,
            }

        return this._requestMaker(options)
            .catch(rawResponse => Promise.reject(this.rebuildError(rawResponse.error)))
    }
}
