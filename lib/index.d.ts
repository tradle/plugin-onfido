import Applicants from './applicants';
import Checks from './checks';
import { Logger, IOnfidoComponent, PluginOpts } from './types';
import APIUtils from './api-utils';
export declare class Onfido implements IOnfidoComponent {
    applicants: Applicants;
    checks: Checks;
    bot: any;
    products: string[];
    padApplicantName: boolean;
    formsToRequestCorrectionsFor: string[];
    logger: Logger;
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
    processWebhookEvent: ({req, res, desiredResult}: {
        req: any;
        res: any;
        desiredResult: any;
    }) => Promise<any>;
    private handleForm;
    private updateApplicantAndCreateCheck;
    private createCheck;
}
declare const _default: (opts: any) => Onfido;
export default _default;
