"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
/// <reference types="debug" />
const debug = require('debug')('mcft:svccom:MessageBrokerRpcHandler');
const common_1 = require("@micro-fleet/common");
const Types_1 = require("../constants/Types");
const rpc = require("../RpcCommon");
const { Service: S, } = common_1.constants;
let MessageBrokerRpcHandler = class MessageBrokerRpcHandler extends rpc.RpcHandlerBase {
    constructor(_config, _msgBrokerConnProvider) {
        super();
        this._config = _config;
        this._msgBrokerConnProvider = _msgBrokerConnProvider;
        common_1.Guard.assertArgDefined('_msgBrokerConnProvider', _msgBrokerConnProvider);
    }
    /**
     * @see IMediateRpcHandler.msgBrokerConnector
     */
    get msgBrokerConnector() {
        return this._msgBrokerConn;
    }
    /**
     * @see IMediateRpcHandler.init
     */
    async init(options = {}) {
        this.name = options.handlerName || this._config.get(S.SERVICE_SLUG).value;
        if (options.connector) {
            this._msgBrokerConn = options.connector;
        }
        else {
            const name = options.connectorName || `Connector for RPC handler "${this.name}"`;
            this._msgBrokerConn = await this._msgBrokerConnProvider.create(name);
        }
        this._msgBrokerConn.onError(err => this._emitError(err));
        this._handlers = new Map();
    }
    /**
     * @see IRpcHandler.start
     */
    start() {
        common_1.Guard.assertIsTruthy(this._msgBrokerConn, 'Must call "init" before use.');
        return this._msgBrokerConn.listen(this.onMessage.bind(this), false);
    }
    /**
     * @see IRpcHandler.dispose
     */
    dispose() {
        // Stop listening then unsbuscribe all topic patterns.
        // DO NOT disconnect the connector as other RPC handlers and callers
        // share this very connector.
        return Promise.all([
            this._msgBrokerConn.stopListen(),
            this._msgBrokerConn.unsubscribeAll(),
        ]);
    }
    /**
     * @see IRpcHandler.pause
     */
    pause() {
        common_1.Guard.assertIsTruthy(this._msgBrokerConn, 'Must call "init" before use.');
        return this._msgBrokerConn.stopListen();
    }
    /**
     * @see IRpcHandler.resume
     */
    resume() {
        return this.start();
    }
    /**
     * @see IRpcHandler.handle
     */
    async handle({ moduleName, actionName, handler, rawDest }) {
        common_1.Guard.assertIsTruthy(this._msgBrokerConn, 'Must call "init" before use.');
        common_1.Guard.assertIsDefined(this.name, '`name` property is required.');
        const dest = Boolean(rawDest)
            ? rawDest
            : `request.${moduleName}.${actionName}`;
        if (this._handlers.has(dest)) {
            debug(`MediateRpcHandler Warning: Override existing subscription key ${dest}`);
        }
        this._handlers.set(dest, handler);
        return this._msgBrokerConn.subscribe(dest);
    }
    onMessage(msg, ack, nack) {
        const routingKey = msg.raw.fields.routingKey;
        if (!this._handlers.has(routingKey)) {
            // Although we nack this message and re-queue it, it will come back
            // if it's not handled by any other service. And we jut keep nack-ing
            // it until the message expires.
            nack();
            return debug(`No handlers for request ${routingKey}`);
        }
        ack();
        const request = msg.data;
        const correlationId = msg.properties.correlationId;
        const replyTo = msg.properties.replyTo;
        (new Promise(async (resolve, reject) => {
            const wrappedReject = (isIntended) => (reason) => reject({
                isIntended,
                reason,
            });
            try {
                const actionFn = this._handlers.get(routingKey);
                // Execute controller's action
                await actionFn({
                    payload: request.payload,
                    resolve,
                    reject: wrappedReject(true),
                    rpcRequest: request,
                    rawMessage: msg,
                });
            }
            catch (err) { // Catch normal exceptions.
                let isIntended = false;
                if (err instanceof common_1.ValidationError) {
                    isIntended = true;
                }
                wrappedReject(isIntended)(err);
            }
        }))
            .then(result => {
            // Sends response to reply topic
            return this._msgBrokerConn.publish(replyTo, this._createResponse(true, result, request.from), { correlationId });
        })
            .catch((error) => {
            // If error from `publish()`
            if (error.isIntended == null) {
                this._emitError(error);
                return Promise.resolve();
            }
            else if (error.isIntended === false) {
                this._emitError(error.reason);
            }
            // If HandlerRejection error, let caller know
            const errObj = this._createError(error);
            return this._msgBrokerConn.publish(replyTo, this._createResponse(false, errObj, request.from), { correlationId });
        })
            // Catch error thrown by `createError()` or `publish()` in above catch
            .catch(this._emitError.bind(this));
    }
};
MessageBrokerRpcHandler = __decorate([
    common_1.decorators.injectable(),
    __param(0, common_1.decorators.inject(common_1.Types.CONFIG_PROVIDER)),
    __param(1, common_1.decorators.inject(Types_1.Types.MSG_BROKER_CONNECTOR_PROVIDER)),
    __metadata("design:paramtypes", [Object, Object])
], MessageBrokerRpcHandler);
exports.MessageBrokerRpcHandler = MessageBrokerRpcHandler;
//# sourceMappingURL=MediateRpcHandler.js.map