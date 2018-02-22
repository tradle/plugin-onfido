import { ILogger } from './types';
import { Onfido } from './';
export default class APIUtils {
    productsAPI: any;
    onfidoAPI: any;
    bot: any;
    logger: ILogger;
    private db;
    private models;
    constructor({logger, bot, onfidoAPI, productsAPI, models}: Onfido);
    getResource: (resource: any, req?: any) => Promise<any>;
    getUser: (permalink: string, req?: any) => Promise<any>;
    checkAddress: ({ address }: {
        address: any;
    }) => Promise<boolean>;
    stub: (resource: any) => any;
    setProps: (resource: any, properties: any) => void;
    isTestMode(): boolean;
}
