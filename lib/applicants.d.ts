import { Logger } from './types';
import APIUtils from './api-utils';
import { IOnfidoComponent } from './types';
import { Onfido } from './';
export default class Applicants implements IOnfidoComponent {
    productsAPI: any;
    bot: any;
    onfidoAPI: any;
    logger: Logger;
    apiUtils: APIUtils;
    padApplicantName: boolean;
    models: any;
    private main;
    constructor(main: Onfido);
    createOrUpdate: ({req, application, state, form}: {
        req: any;
        application: any;
        state: any;
        form: any;
    }) => Promise<boolean>;
    update: ({req, application, state, form}: {
        req: any;
        application: any;
        state: any;
        form: any;
    }) => Promise<boolean>;
    uploadSelfie: ({req, application, state, selfie}: {
        req: any;
        application: any;
        state: any;
        selfie: any;
    }) => Promise<boolean>;
    uploadPhotoID: ({req, application, state, photoID}: {
        req: any;
        application: any;
        state: any;
        photoID: any;
    }) => Promise<boolean>;
    list: (opts: any) => Promise<any>;
}
