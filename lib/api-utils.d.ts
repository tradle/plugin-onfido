import { ILogger } from './types';
import { Onfido } from './';
export default class APIUtils {
    productsAPI: any;
    onfidoAPI: any;
    logger: ILogger;
    models: any;
    private db;
    constructor({logger, models, onfidoAPI, productsAPI}: Onfido);
    getResource: (resource: any) => Promise<any>;
    checkAddress: ({address}: {
        address: any;
    }) => Promise<boolean>;
    stub: (resource: any) => any;
    isTestMode(): boolean;
}
