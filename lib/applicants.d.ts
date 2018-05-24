import { ILogger, Resource } from './types';
import APIUtils from './api-utils';
import { IOnfidoComponent, OnfidoState } from './types';
import { Onfido } from './';
export default class Applicants implements IOnfidoComponent {
    bot: any;
    onfidoAPI: any;
    applications: any;
    logger: ILogger;
    apiUtils: APIUtils;
    padApplicantName: boolean;
    preCheckAddress: boolean;
    private main;
    constructor(main: Onfido);
    createOrUpdate: ({ req, application, check, form }: OnfidoState) => Promise<boolean>;
    update: ({ req, application, check, form, props }: {
        application: any;
        check: Resource;
        req?: any;
        form?: any;
        props?: any;
    }) => Promise<boolean>;
    uploadSelfie: ({ req, application, check, form }: OnfidoState) => Promise<boolean>;
    uploadPhotoID: ({ req, application, check, form }: OnfidoState) => Promise<boolean>;
}
