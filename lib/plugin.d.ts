import Applicants from './applicants';
import Checks from './checks';
import { ILogger, IOnfidoComponent, PluginOpts, OnfidoState, ProductOptions } from './types';
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
    productsAPI: any;
    apiUtils: APIUtils;
    conf: any;
    constructor(opts: PluginOpts);
    ['onmessage:tradle.Form']: (req: any) => Promise<any>;
    private ensureProductSupported;
    private getProductOptions;
    private putStatePointer;
    private getStatePointer;
    handleOnfidoError: ({req, error}: {
        req: any;
        error: any;
    }) => Promise<boolean>;
    createCheck: ({req, application, state, saveState, reports}: {
        req?: any;
        reports?: string[];
        application: any;
        state: any;
        saveState: boolean;
    }) => Promise<any>;
    unregisterWebhook: ({url}: {
        url: any;
    }) => Promise<void>;
    registerWebhook: ({url, events}: {
        url: string;
        events?: string[];
    }) => Promise<any>;
    getWebhook: () => Promise<any>;
    processWebhookEvent: ({req, res, body, desiredResult}: {
        req: any;
        res: any;
        body: any;
        desiredResult: any;
    }) => Promise<void>;
    private handleForm;
    private _handleForm;
    updateApplicant: ({req, application, state, form}: OnfidoState) => Promise<boolean>;
    uploadAttachments: ({req, application, state, form}: OnfidoState) => Promise<boolean>;
    getState: (permalink: string) => Promise<any>;
    listStates: (opts: any) => Promise<any>;
    sync: () => Promise<void>;
    private getForm;
}
export { Onfido };
