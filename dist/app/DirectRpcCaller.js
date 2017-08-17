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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const request = require("request-promise-native");
const back_lib_common_util_1 = require("back-lib-common-util");
const rpc = require("./RpcCommon");
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
     * @see IRpcCaller.call
     */
    call(moduleName, action, params) {
        return __awaiter(this, void 0, void 0, function* () {
            back_lib_common_util_1.Guard.assertArgDefined('moduleName', moduleName);
            back_lib_common_util_1.Guard.assertArgDefined('action', action);
            back_lib_common_util_1.Guard.assertIsDefined(this._baseAddress, 'Base URL must be set!');
            let request = {
                from: this._name,
                to: moduleName,
                payload: params
            }, options = {
                method: 'POST',
                uri: `http://${this._baseAddress}/${moduleName}/${action}`,
                body: request,
                json: true // Automatically stringifies the body to JSON
            };
            try {
                return yield this._requestMaker(options);
            }
            catch (rawResponse) {
                throw rawResponse.error;
            }
        });
    }
};
HttpRpcCaller = __decorate([
    back_lib_common_util_1.injectable(),
    __metadata("design:paramtypes", [])
], HttpRpcCaller);
exports.HttpRpcCaller = HttpRpcCaller;
