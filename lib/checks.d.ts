import { Onfido } from './';
import APIUtils from './api-utils';
import { IOnfidoComponent, ILogger, Check, Resource } from './types';
export default class Checks implements IOnfidoComponent {
    applications: any;
    bot: any;
    onfidoAPI: any;
    logger: ILogger;
    apiUtils: APIUtils;
    constructor(main: Onfido);
    create: ({ req, application, check, reports }: {
        req?: any;
        application: any;
        check: Resource;
        reports: string[];
    }) => Promise<void>;
    processReport: ({ req, application, check, report }: {
        req?: any;
        application: any;
        check: Resource;
        report: any;
    }) => Promise<void>;
    processCheck: ({ req, application, check, onfidoCheck }: {
        req?: any;
        application: any;
        check: Resource;
        onfidoCheck: any;
    }) => Promise<void>;
    processCompletedReport: ({ req, application, check, report }: {
        req: any;
        application: any;
        check: any;
        report: any;
    }) => Promise<void>;
    fetchFromOnfido: ({ applicantId, checkId }: {
        applicantId: string;
        checkId: string;
    }) => Promise<any>;
    list: () => Promise<Check[]>;
    getByCheckId: (checkId: any) => Promise<Resource>;
    listWithApplication: (permalink: any) => Promise<Check[]>;
    listWithStatus: (status: string | string[]) => Promise<Check[]>;
    listPending: () => Promise<Check[]>;
    listCompleted: () => Promise<Check[]>;
    listWithdrawn: () => Promise<Check[]>;
    sync: () => Promise<void>;
    private _list;
}
