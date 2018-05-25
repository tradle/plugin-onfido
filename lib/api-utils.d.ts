import { ILogger } from './types';
import { Onfido } from './';
export default class APIUtils {
    applications: any;
    onfidoAPI: any;
    bot: any;
    logger: ILogger;
    private db;
    private models;
    constructor({logger, bot, onfidoAPI, applications, models}: Onfido);
    getResource: (resource: any, req?: any) => Promise<any>;
    getUser: (permalink: string, req?: any) => Promise<any>;
    checkAddress: ({ address }: {
        address: any;
    }) => Promise<boolean>;
    stub: (resource: any) => any;
    setProps: (resource: any, properties: any) => void;
    toStableStub: (stub: any) => any;
    isTestMode(): boolean;
    sanitize: (obj: any) => any;
}
