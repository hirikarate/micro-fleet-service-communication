import * as http from 'http';

import * as express from 'express';
import * as bodyParser from 'body-parser';

import { injectable, inject, IDependencyContainer, Guard, Exception, Types as CmT } from 'back-lib-common-util';

import * as rpc from './RpcCommon';


export interface ExpressRpcHandlerInitOptions {
	expressApp: express.Express;
	expressRouter: express.Router;
}

export interface IDirectRpcHandler extends rpc.IRpcHandler {
	/**
	 * Http ports to listen
	 */
	port: number;

	/**
	 * @override
	 * @see IRpcHandler.init
	 */
	init(params?: ExpressRpcHandlerInitOptions): void;

	/**
	 * @override IRpcHandler.handle to return void.
	 */
	handle(actions: string | string[], dependencyIdentifier: string | symbol, actionFactory?: rpc.RpcActionFactory): void;
}

@injectable()
export class ExpressRpcHandler
			extends rpc.RpcHandlerBase
			implements IDirectRpcHandler {

	private static URL_TESTER: RegExp = (function() {
			let regexp = new RegExp(/^[a-zA-Z0-9_-]*$/);
			regexp.compile();
			return regexp;
		})();

	public port: number;

	private _server: http.Server;
	private _app: express.Express;
	private _router: express.Router;


	constructor(
		@inject(CmT.DEPENDENCY_CONTAINER) depContainer: IDependencyContainer
	) {
		super(depContainer);
		this.port = 30000;
	}


	/**
	 * @see IDirectRpcHandler.init
	 */
	public init(param?: ExpressRpcHandlerInitOptions): void {
		Guard.assertIsFalsey(this._router, 'This RPC Caller is already initialized!');
		Guard.assertIsTruthy(this.name, '`name` property must be set!');

		let app: express.Express;
		app = this._app = (param && param.expressApp) 
			? param.expressApp 
			: express();

		this._router = (param && param.expressRouter) ? param.expressRouter : express.Router();
		//app.use(bodyParser.urlencoded({extended: true})); // Parse Form values in POST request, but I don't think we need it in this case.
		app.use(bodyParser.json()); // Parse JSON in POST request
		app.use(`/${this.name}`, this._router);
		
	}

	/**
	 * @see IRpcHandler.start
	 */
	public start(): Promise<void> {
		return new Promise<void>(resolve => {
			this._server = this._app.listen(this.port, resolve);
			this._server.on('error', err => this.emitError(err));
		});
	}

	/**
	 * @see IRpcHandler.dispose
	 */
	public dispose(): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			this._server.close(() => {
				this._server = null;
				resolve();
			});
		});
	}

	/**
	 * @see IRpcHandler.handle
	 */
	public handle(actions: string | string[], dependencyIdentifier: string | symbol, actionFactory?: rpc.RpcActionFactory): void {
		Guard.assertIsDefined(this._router, '`init` method must be called first!');
		
		actions = Array.isArray(actions) ? actions : [actions];
		
		for (let a of actions) {
			Guard.assertIsMatch(ExpressRpcHandler.URL_TESTER, a, `Route "${a}" is not URL-safe!`);
			this._router.post(`/${a}`, this.buildHandleFunc(a, dependencyIdentifier, actionFactory));
		}
	}


	private buildHandleFunc(action: string, dependencyIdentifier: string | symbol, actionFactory?: rpc.RpcActionFactory): express.RequestHandler {
		return (req: express.Request, res: express.Response) => {
			let request: rpc.IRpcRequest = req.body;

			(new Promise((resolve, reject) => {
				let actionFn = this.resolveActionFunc(action, dependencyIdentifier, actionFactory);
				try {
					// Execute controller's action
					let output: any = actionFn(request.payload, resolve, reject, request);
					if (output instanceof Promise) {
						output.catch(reject); // Catch async exceptions.
					}
				} catch (err) { // Catch normal exceptions.
					reject(err);
				}
			}))
			.then(result => {
				res.status(200).send(this.createResponse(true, result, request.from));
			})
			.catch(error => {
				let errMsg = error,
					statusCode = 200;

				// If error is an uncaught Exception/Error object, that means the action method
				// has a problem. We should response with error status code.
				if (error instanceof Error) {
					// Clone to a plain object, as class Error has problem
					// with JSON.stringify.
					errMsg = {
						message: error.message
					};
					statusCode = 500;
				} else if (error instanceof Exception) {
					// TODO: Should log this unexpected error.
					statusCode = 500;
					delete error.stack;
				}

				// If this is a reject error, which means the action method sends this error
				// back to caller on purpose.
				res.status(statusCode).send(this.createResponse(false, errMsg, request.from));
			});
		};
	}
}