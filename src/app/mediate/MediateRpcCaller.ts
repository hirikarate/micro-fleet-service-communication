/// <reference types="debug" />
const debug: debug.IDebugger = require('debug')('mcft:svccom:MessageBrokerRpcCaller')

import * as shortid from 'shortid'
import { decorators as d, Types as cT, constants, Guard, MinorException, InternalErrorException,
    IConfigurationProvider, SettingItemDataType } from '@micro-fleet/common'

import { Types as T } from '../constants/Types'
import { IMessageBrokerConnector, BrokerMessage } from '../MessageBrokerConnector'
import { IMessageBrokerConnectorProvider } from '../MessageBrokerProviderAddOn'
import * as rpc from '../RpcCommon'


const {
    Service: S,
    RPC,
} = constants

export type MediateRpcCallerOptions = {
    /**
     * The name used in "from" property of sent messages.
     */
    callerName?: string,

    /**
     * Message broker connector instance to reuse.
     */
    connector?: IMessageBrokerConnector,

    /**
     * Message broker connector name to create new,
     * if not reusing any existing connector.
     *
     * If neither `connector` nor `connectorName` is specified, a default name is used
     */
    connectorName?: string,
}

export interface IMediateRpcCaller extends rpc.IRpcCaller {
    /**
     * Gets the message broker connector instance used for making mediate RPC calls.
     */
    readonly msgBrokerConnector: IMessageBrokerConnector

    /**
     * Initializes this caller before use.
     */
    init(options?: MediateRpcCallerOptions): Promise<void>
}

@d.injectable()
export class MessageBrokerRpcCaller
            extends rpc.RpcCallerBase
            implements IMediateRpcCaller {

    private _msgBrokerConn: IMessageBrokerConnector

    /**
     * @see IMediateRpcCaller.msgBrokerConnector
     */
    public get msgBrokerConnector(): IMessageBrokerConnector {
        return this._msgBrokerConn
    }

    constructor(
        @d.inject(cT.CONFIG_PROVIDER) private _config: IConfigurationProvider,
        @d.inject(T.MSG_BROKER_CONNECTOR_PROVIDER) private _msgBrokerConnProvider: IMessageBrokerConnectorProvider
    ) {
        super()
        Guard.assertArgDefined('_msgBrokerConnProvider', _msgBrokerConnProvider)

        if (this._msgBrokerConn.queue) {
            debug('MessageBrokerRpcCaller should only use temporary unique queue.')
        }
    }

    /**
     * @see IMediateRpcCaller.init
     */
    public async init(options: MediateRpcCallerOptions = {}): Promise<void> {
        this.name = options.callerName || this._config.get(S.SERVICE_SLUG).value
        if (options.connector) {
            this._msgBrokerConn = options.connector
        }
        else {
            const name = options.connectorName || `Connector for RPC caller "${this.name}"`
            this._msgBrokerConn = await this._msgBrokerConnProvider.create(name)
        }
        this._msgBrokerConn.messageExpiredIn = this._config
            .get(RPC.RPC_CALLER_TIMEOUT, SettingItemDataType.Number)
            .tryGetValue(30000)
        this._msgBrokerConn.onError(err => this._emitError(err))
    }

    /**
     * @see IRpcCaller.dispose
     */
    public async dispose(): Promise<void> {
        // DO NOT disconnect the connector as other RPC handlers and callers
        // may share this very connector.
        this._msgBrokerConn && (this._msgBrokerConn = null)
        await super.dispose()
    }

    /**
     * @see IRpcCaller.call
     */
    public call({ moduleName, actionName, params, rawDest }: rpc.RpcCallerOptions): Promise<rpc.RpcResponse> {
        Guard.assertIsTruthy(this._msgBrokerConn, 'Must call "init" before use.')
        if (!rawDest) {
            Guard.assertArgDefined('moduleName', moduleName)
            Guard.assertArgDefined('actionName', actionName)
        }

        return new Promise<rpc.RpcResponse>((resolve, reject) => {
            // There are many requests to same `requestTopic` and they listen to same `responseTopic`,
            // A request only cares about a response with same `correlationId`.
            const correlationId = shortid.generate(),
                replyTo = Boolean(rawDest)
                    ? `response.${rawDest}@${correlationId}`
                    : `response.${moduleName}.${actionName}@${correlationId}`,
                conn = this._msgBrokerConn

            conn.subscribe(replyTo)
                .then(() => {
                    let token: NodeJS.Timer
                    const onMessage = async (msg: BrokerMessage) => {
                        clearTimeout(token)
                        // We got what we want, stop consuming.
                        await conn.unsubscribe(replyTo)
                        await conn.stopListen()

                        const response: rpc.RpcResponse = msg.data
                        if (!response.isSuccess) {
                            response.payload = this._rebuildError(response.payload)
                            if (response.payload instanceof InternalErrorException) {
                                return reject(response.payload)
                            }
                        }
                        resolve(response)
                    }

                    // In case this request never has response.
                    token = setTimeout(() => {
                        this._emitter && this._emitter.removeListener(correlationId, onMessage)
                        conn && conn.unsubscribe(replyTo).catch(() => { /* Swallow */ })
                        reject(new MinorException('Response waiting timeout'))
                    }, this.timeout)

                    this._emitter.once(correlationId, onMessage)

                    return conn.listen((msg: BrokerMessage) => {
                        // Announce that we've got a response with this correlationId.
                        this._emitter.emit(msg.properties.correlationId, msg)
                    })
                })
                .then(() => {
                    const request: rpc.RpcRequest = {
                        from: this.name,
                        to: moduleName,
                        payload: params,
                    }

                    // Send request, marking the message with correlationId.
                    return conn.publish(rawDest || `request.${moduleName}.${actionName}`, request,
                        { correlationId, replyTo })
                })
                .catch(err => {
                    reject(new MinorException(`RPC error: ${err}`))
                })
        })
    }

    /**
     * @see IRpcCaller.callImpatient
     */
    public callImpatient({ moduleName, actionName, params, rawDest }: rpc.RpcCallerOptions): Promise<void> {
        Guard.assertIsTruthy(this._msgBrokerConn, 'Must call "init" before use.')
        if (!rawDest) {
            Guard.assertArgDefined('moduleName', moduleName)
            Guard.assertArgDefined('actionName', actionName)
        }
        const request: rpc.RpcRequest = {
            from: this.name,
            to: moduleName,
            payload: params,
        }

        // Send request, marking the message with correlationId.
        return this._msgBrokerConn.publish(rawDest || `request.${moduleName}.${actionName}`, request)
            .catch(err => new MinorException(`RPC error: ${err}`)) as any
    }
}
