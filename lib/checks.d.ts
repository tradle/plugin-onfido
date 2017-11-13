import { Onfido } from './';
import APIUtils from './api-utils';
import { IOnfidoComponent, ILogger, CheckMapping } from './types';
export default class Checks implements IOnfidoComponent {
    productsAPI: any;
    bot: any;
    onfidoAPI: any;
    logger: ILogger;
    apiUtils: APIUtils;
    models: any;
    constructor(main: Onfido);
    create: ({req, application, state, reports}: {
        req: any;
        application: any;
        state: any;
        reports: string[];
    }) => Promise<any>;
    processReport: ({req, application, state, check, report}: {
        req: any;
        application: any;
        state: any;
        check: any;
        report: any;
    }) => Promise<void>;
    processCheck: ({req, application, state, current, update}: {
        req?: any;
        application: any;
        state: any;
        current: any;
        update: any;
    }) => Promise<any>;
    processCompletedReport: ({req, application, state, report}: {
        req: any;
        application: any;
        state: any;
        report: any;
    }) => Promise<void>;
    lookupByCheckId: (checkId: string) => Promise<{
        application: any;
        state: any;
        check: any;
    }>;
    saveCheckMapping: ({state, check}: {
        state: any;
        check: any;
    }) => any;
    getCheckMapping: (checkId: string) => Promise<CheckMapping>;
    fetch: ({applicantId, checkId}: {
        applicantId: string;
        checkId: string;
    }) => any;
}
