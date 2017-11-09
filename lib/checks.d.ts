import { Onfido } from './';
import APIUtils from './api-utils';
import { IOnfidoComponent, ILogger } from './types';
export default class Checks implements IOnfidoComponent {
    productsAPI: any;
    onfidoAPI: any;
    logger: ILogger;
    apiUtils: APIUtils;
    models: any;
    constructor(main: Onfido);
    create: ({state, reports}: {
        state: any;
        reports: string[];
    }) => Promise<any>;
    processCheck: ({state, check, update}: {
        state: any;
        check: any;
        update: any;
    }) => Promise<void>;
}
