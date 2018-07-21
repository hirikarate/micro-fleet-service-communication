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
Object.defineProperty(exports, "__esModule", { value: true });
const request = require("request-promise");
const common_1 = require("@micro-fleet/common");
const rpc = require("../RpcCommon");
let HttpRpcCaller = class HttpRpcCaller extends rpc.RpcCallerBase {
    constructor() {
        super();
        this._requestMaker = request;
    }
    get baseAddress() {
        return this._baseAddress;
    }
    set baseAddress(val) {
        this._baseAddress = val;
    }
    /**
     * @see IRpcCaller.init
     */
    init(param) {
    }
    /**
     * @see IRpcCaller.dispose
     */
    async dispose() {
        await super.dispose();
        this._requestMaker = null;
    }
    /**
     * @see IRpcCaller.call
     */
    call(moduleName, action, params) {
        common_1.Guard.assertArgDefined('moduleName', moduleName);
        common_1.Guard.assertArgDefined('action', action);
        common_1.Guard.assertIsDefined(this._baseAddress, 'Base URL must be set!');
        let request = {
            from: this.name,
            to: moduleName,
            payload: params
        }, options = {
            method: 'POST',
            uri: `http://${this._baseAddress}/${moduleName}/${action}`,
            body: request,
            json: true,
            timeout: this.timeout
        };
        return this._requestMaker(options)
            .catch(rawResponse => Promise.reject(this.rebuildError(rawResponse.error)));
    }
};
HttpRpcCaller = __decorate([
    common_1.injectable(),
    __metadata("design:paramtypes", [])
], HttpRpcCaller);
exports.HttpRpcCaller = HttpRpcCaller;
//# sourceMappingURL=DirectRpcCaller.js.map