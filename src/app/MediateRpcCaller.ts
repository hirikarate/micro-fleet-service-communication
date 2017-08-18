import { EventEmitter } from 'events';

import * as shortid from 'shortid';
import { injectable, inject, IDependencyContainer, Guard, MinorException } from 'back-lib-common-util';

import { Types as T } from './Types';
import { IMessageBrokerConnector, IMessage } from './MessageBrokerConnector';
import * as rpc from './RpcCommon';


export interface IMediateRpcCaller extends rpc.IRpcCaller {
}

@injectable()
export class MessageBrokerRpcCaller
			extends rpc.RpcCallerBase
			implements IMediateRpcCaller {

	constructor(
		@inject(T.MSG_BROKER_CONNECTOR) private _msgBrokerConn: IMessageBrokerConnector
	) {
		super();
		Guard.assertArgDefined('_msgBrokerConn', _msgBrokerConn);

		this._msgBrokerConn.queue = ''; // Make sure we only use temporary unique queue.
		
	}

	/**
	 * @see IRpcCaller.init
	 */
	public init(params?: any): void {
		let expire = this._msgBrokerConn.messageExpiredIn;
		this._msgBrokerConn.messageExpiredIn = expire > 0 ? expire : 30000; // Make sure we only use temporary unique queue.
		this._msgBrokerConn.onError(err => this.emitError(err));
	}

	/**
	 * @see IRpcCaller.dispose
	 */
	public async dispose(): Promise<void> {
		await super.dispose();
		this._msgBrokerConn = null;
	}

	/**
	 * @see IRpcCaller.call
	 */
	public call(moduleName: string, action: string, params?: any): Promise<rpc.IRpcResponse> {
		Guard.assertArgDefined('moduleName', moduleName);
		Guard.assertArgDefined('action', action);

		return new Promise<rpc.IRpcResponse>((resolve, reject) => {
			// There are many requests to same `requestTopic` and they listen to same `responseTopic`,
			// A request only cares about a response with same `correlationId`.
			const correlationId = shortid.generate(),
				replyTo = `response.${moduleName}.${action}`,
				conn = this._msgBrokerConn;

			conn.subscribe(replyTo)
				.then(() => {
					let onMessage = async (msg: IMessage) => {
						// We got what we want, stop consuming.
						await conn.unsubscribe(replyTo);
						await conn.stopListen();
						resolve(<rpc.IRpcResponse>msg.data);
					};

					// In case this request never has response.
					let token = setTimeout(() => {
						this._emitter && this._emitter.removeListener(correlationId, onMessage);
						this._msgBrokerConn && conn.unsubscribe(replyTo).catch(() => { /* Swallow */ });
						reject(new MinorException('Response waiting timeout'));
					}, this.timeout);

					this._emitter.once(correlationId, msg => {
						clearTimeout(token);
						onMessage(msg);
					});

					return conn.listen((msg: IMessage) => {
						// Announce that we've got a response with this correlationId.
						this._emitter.emit(msg.properties.correlationId, msg);
					});
				})
				.then(() => {
					let request: rpc.IRpcRequest = {
						from: this.name,
						to: moduleName,
						payload: params
					};

					// Send request, marking the message with correlationId.
					return this._msgBrokerConn.publish(`request.${moduleName}.${action}`, request, 
						{ correlationId, replyTo });
				})
				.catch(err => {
					reject(new MinorException(`RPC error: ${err}`));
				});
		});
	}
}