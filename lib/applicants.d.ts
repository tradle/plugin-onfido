import { ILogger } from './types';
import APIUtils from './api-utils';
import { IOnfidoComponent, OnfidoState } from './types';
import { Onfido } from './';
export default class Applicants implements IOnfidoComponent {
    bot: any;
    onfidoAPI: any;
    logger: ILogger;
    apiUtils: APIUtils;
    padApplicantName: boolean;
    preCheckAddress: boolean;
    models: any;
    private main;
    constructor(main: Onfido);
    createOrUpdate: ({req, application, state, form}: OnfidoState) => Promise<boolean>;
    update: ({req, application, state, form}: OnfidoState) => Promise<boolean>;
    uploadSelfie: ({req, application, state, form}: OnfidoState) => Promise<boolean>;
    uploadPhotoID: ({req, application, state, form}: OnfidoState) => Promise<boolean>;
}
