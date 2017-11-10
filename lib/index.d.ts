import Applicants from './applicants';
import Checks from './checks';
import { ILogger, IOnfidoComponent, PluginOpts } from './types';
import APIUtils from './api-utils';
export declare class Onfido implements IOnfidoComponent {
    applicants: Applicants;
    checks: Checks;
    bot: any;
    products: string[];
    padApplicantName: boolean;
    formsToRequestCorrectionsFor: string[];
    webhookKey: string;
    logger: ILogger;
    onfidoAPI: any;
    productsAPI: any;
    apiUtils: APIUtils;
    models: any;
    constructor(opts: PluginOpts);
    ['onmessage:tradle.Form']: (req: any) => void | Promise<any>;
    handleOnfidoError: ({req, error}: {
        req: any;
        error: any;
    }) => Promise<boolean>;
    createCheck: ({application, state, reports}: {
        application: any;
        state: any;
        reports: any;
    }) => Promise<any>;
    registerWebhook: ({url, events}: {
        url: string;
        events?: string[];
    }) => Promise<any>;
    processWebhookEvent: ({req, res, desiredResult}: {
        req: any;
        res: any;
        desiredResult: any;
    }) => Promise<any>;
    private handleForm;
    private updateApplicantAndCreateCheck;
}
declare const _default: (opts: any) => Onfido;
export default _default;
