"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const _ = require("lodash");
const parseDataUri = require("parse-data-uri");
const utils_1 = require("./utils");
const constants_1 = require("./constants");
class Applicants {
    constructor(main) {
        this.createOrUpdate = async ({ req, application, check, form }) => {
            if (!check) {
                throw new Error('expected "check"');
            }
            const { models } = this.bot;
            const productOptions = this.main.getProductOptions(application.requestFor);
            const propertyMap = this.main.getPropertyMap(application.requestFor);
            const fStub = form && this.apiUtils.stub(form);
            const parsedStubs = utils_1.getFormsToCreateApplicant({
                models,
                forms: utils_1.getFormStubs(application).concat(fStub ? utils_1.parseStub(fStub) : []),
                reports: productOptions.reports,
                propertyMap
            });
            if (!parsedStubs) {
                this.logger.debug(`not enough info to create an applicant (yet)`, {
                    application: application._permalink
                });
                return false;
            }
            const parsedStubsAndForms = parsedStubs.slice();
            const forms = await Promise.all(parsedStubsAndForms.map(item => this.apiUtils.getResource(item, req)));
            const props = utils_1.getApplicantProps({ models, forms, propertyMap });
            const { first_name, last_name, dob, addresses = [] } = props;
            const needAddress = utils_1.isAddressRequired(productOptions.reports);
            if (!needAddress)
                addresses.length = 0;
            if (!(first_name && last_name && dob && (addresses.length || !needAddress))) {
                return false;
            }
            if (addresses.length && this.preCheckAddress) {
                await this.apiUtils.checkAddress({ address: addresses[0] });
            }
            const applicant = utils_1.parseStub(application.applicant).permalink;
            if (this.padApplicantName) {
                // to ensure uniqueness during testing
                props.last_name += applicant.slice(0, 4);
            }
            const isUpdate = !!check.get('onfidoApplicant');
            const verb = isUpdate ? 'updating' : 'creating';
            this.logger.debug(`${verb} applicant`, {
                application: application._permalink
            });
            let onfidoApplicant;
            try {
                if (isUpdate) {
                    onfidoApplicant = await this.update({ req, application, check, props });
                }
                else {
                    onfidoApplicant = await this.onfidoAPI.applicants.create(props);
                }
            }
            catch (err) {
                this.logger.error(`failed to create or update applicant ${applicant}`, err);
                throw err;
            }
            if (onfidoApplicant) {
                check.set({
                    onfidoApplicant: this.apiUtils.sanitize(onfidoApplicant),
                    applicantDetails: parsedStubs.map(utils_1.stubFromParsedStub)
                });
            }
            return true;
        };
        this.update = async ({ req, application, check, form, props }) => {
            if (!props) {
                if (!form) {
                    throw new Error('expected "form" or "props');
                }
                props = utils_1.getApplicantProps({
                    models: this.bot.models,
                    forms: [form],
                    propertyMap: this.main.getPropertyMap(application.requestFor)
                });
            }
            if (props) {
                const current = check.get('onfidoApplicant');
                if (hasUpdate({ current, update: props })) {
                    this.logger.debug('updating applicant', {
                        application: application._permalink
                    });
                    return await this.onfidoAPI.applicants.update(current.id, props);
                }
            }
        };
        this.uploadSelfie = async ({ req, application, check, form }) => {
            utils_1.ensureNoPendingCheck(check);
            if (!form) {
                throw new Error(`expected "form" to be ${constants_1.SELFIE}`);
            }
            const { selfie } = form;
            const { mimeType, data } = parseDataUri(selfie.url);
            this.logger.debug('uploading selfie', {
                application: application._permalink
            });
            try {
                const result = await this.onfidoAPI.applicants.uploadLivePhoto(check.get('onfidoApplicant').id, {
                    file: data,
                    filename: `live-photo-${utils_1.digest(data)}.${utils_1.getExtension(mimeType)}`
                });
                check.set({
                    selfie: this.apiUtils.stub(form)
                });
                return true;
            }
            catch (error) {
                // {
                //   "body": {
                //     "type": "validation_error",
                //     "message": "There was a validation error on this request",
                //     "fields": {
                //       "face_detection": [
                //         "Face not detected in image. Please note this validation can be disabled by setting the advanced_validation parameter to false."
                //       ]
                //     }
                //   },
                //   "status": 422
                // }
                this.logger.error('upload selfie failed', error);
                return await this.main.handleOnfidoError({ req, error });
            }
        };
        this.uploadPhotoID = async ({ req, application, check, form }) => {
            utils_1.ensureNoPendingCheck(check);
            if (!form) {
                throw new Error(`expected "form" to be ${constants_1.PHOTO_ID}`);
            }
            const { scan, documentType } = form;
            const { mimeType, data } = parseDataUri(scan.url);
            const onfidoDocType = documentType.id === 'passport' ? 'passport' : 'driving_licence';
            const document = {
                type: onfidoDocType,
                file: data,
                filename: `${onfidoDocType}-${utils_1.digest(data)}.${utils_1.getExtension(mimeType)}`
            };
            if (!utils_1.hasTwoSides(documentType)) {
                document.side = 'front';
            }
            this.logger.debug('uploading photoID document', {
                application: application._permalink
            });
            try {
                await this.onfidoAPI.applicants.uploadDocument(check.get('onfidoApplicant').id, document);
                check.set({
                    photoID: this.apiUtils.stub(form)
                });
                return true;
            }
            catch (error) {
                await this.main.handleOnfidoError({ req, error });
            }
            return false;
        };
        this.main = main;
        this.bot = main.bot;
        this.onfidoAPI = main.onfidoAPI;
        this.applications = main.applications;
        this.logger = main.logger;
        this.apiUtils = main.apiUtils;
        this.padApplicantName = main.padApplicantName;
        this.preCheckAddress = main.preCheckAddress;
    }
}
exports.default = Applicants;
const hasUpdate = ({ current, update }) => !_.isMatch(current, update);
//# sourceMappingURL=applicants.js.map