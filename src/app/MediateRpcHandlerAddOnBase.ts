import { SvcSettingKeys as S } from 'back-lib-common-constants';
import { IConfigurationProvider } from 'back-lib-common-contracts';
import { inject, injectable, Guard } from 'back-lib-common-util';

import { IMediateRpcHandler } from './MediateRpcHandler';


/**
 * Base class for MediateRpcAddOn.
 */
@injectable()
export abstract class MediateRpcHandlerAddOnBase implements IServiceAddOn {

	protected abstract controllerIdentifier: string | symbol;

	constructor(
		protected _configProvider: IConfigurationProvider,
		protected _rpcHandler: IMediateRpcHandler
	) {
		Guard.assertArgDefined('_configProvider', _configProvider);
		Guard.assertArgDefined('_rpcHandler', _rpcHandler);
	}


	/**
	 * @see IServiceAddOn.init
	 */
	public init(moduleName: string = null): Promise<void> {
		this._rpcHandler.name = moduleName;
		this._rpcHandler.init();
		this.handleRequests();
		return this._rpcHandler.start();
	}

	/**
	 * @see IServiceAddOn.deadLetter
	 */
	public deadLetter(): Promise<void> {
		return Promise.resolve();
	}

	/**
	 * @see IServiceAddOn.dispose
	 */
	public dispose(): Promise<void> {
		this._configProvider = null;
		let handler = this._rpcHandler;
		this._rpcHandler = null;
		return handler.dispose();
	}


	protected handleRequests(): void {
		this._rpcHandler.handleCRUD(this.controllerIdentifier);
	}
}