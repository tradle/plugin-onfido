import Applicants from './applicants';
import Checks from './checks';
import { ILogger, IOnfidoComponent, PluginOpts, OnfidoState, ProductOptions, OnfidoResult, Resource } from './types';
import APIUtils from './api-utils';
export default class Onfido implements IOnfidoComponent {
    applicants: Applicants;
    checks: Checks;
    bot: any;
    products: ProductOptions[];
    padApplicantName: boolean;
    formsToRequestCorrectionsFor: string[];
    preCheckAddress: boolean;
    webhookKey: string;
    logger: ILogger;
    onfidoAPI: any;
    applications: any;
    apiUtils: APIUtils;
    conf: any;
    readonly models: any;
    constructor(opts: PluginOpts);
    ['onmessage:tradle.Form']: (req: any) => Promise<any>;
    private ensureProductSupported;
    getProductOptions: (productModelId: string) => ProductOptions;
    handleOnfidoError: ({ req, error }: {
        req: any;
        error: any;
    }) => Promise<boolean>;
    createOnfidoCheck: ({ req, application, check, reports }: {
        req?: any;
        reports?: string[];
        application: any;
        check: Resource;
    }) => Promise<void>;
    unregisterWebhook: ({ url }: {
        url: any;
    }) => Promise<void>;
    registerWebhook: ({ url, events }: {
        url: string;
        events?: string[];
    }) => Promise<any>;
    getWebhook: () => Promise<any>;
    processWebhookEvent: (opts: any) => Promise<void>;
    _processWebhookEvent: ({ req, body, desiredResult }: {
        req: any;
        body?: any;
        desiredResult?: OnfidoResult;
    }) => Promise<void>;
    private handleForm;
    private _handleForm;
    updateApplicant: ({ req, application, check, form }: OnfidoState) => Promise<boolean>;
    uploadAttachments: ({ req, application, check, form }: OnfidoState) => Promise<boolean>;
    sync: () => Promise<void>;
    private getForm;
    private getRequiredAttachments;
    private hasRequiredAttachments;
}
export { Onfido };
