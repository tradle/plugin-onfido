"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const deepEqual = require("deep-equal");
const parseDataUri = require("parse-data-uri");
const constants_1 = require("@tradle/constants");
const onfido_models_1 = require("./onfido-models");
const utils_1 = require("./utils");
const constants_2 = require("./constants");
class Applicants {
    constructor(main) {
        this.createOrUpdate = ({ req, application, state, form }) => __awaiter(this, void 0, void 0, function* () {
            if (!state) {
                throw new Error('expected "state"');
            }
            const stubsAndForms = utils_1.getFormsToCreateApplicant(application);
            if (!stubsAndForms) {
                this.logger.debug(`don't have the requisite forms to create an applicant`);
                return false;
            }
            if (form) {
                const fStub = this.apiUtils.stub(form);
                const idx = stubsAndForms.findIndex(stub => stub.id === fStub.id);
                if (idx !== -1) {
                    // no need to look this one up, we already have the body
                    stubsAndForms[idx] = form;
                }
            }
            const forms = yield Promise.all(stubsAndForms.map(item => this.apiUtils.getResource(item)));
            const props = utils_1.getApplicantProps(forms);
            const { name, dob, addresses } = props;
            if (!(name && dob && addresses && addresses.length)) {
                return false;
            }
            yield this.apiUtils.checkAddress({ address: addresses[0] });
            const applicant = utils_1.parseStub(application.applicant).permalink;
            // to ensure uniqueness during testing
            if (this.padApplicantName) {
                props.name.last_name += applicant.slice(0, 4);
            }
            if (state.onfidoApplicant) {
                const isDiff = Object.keys(props).some(key => {
                    return !deepEqual(props[key], state.onfidoApplicant[key]);
                });
                if (!isDiff) {
                    this.logger.debug('skipping update, no changes to push');
                    return false;
                }
                try {
                    yield this.onfidoAPI.applicants.update(props);
                    return true;
                }
                catch (err) {
                    this.logger.error(`failed to update applicant ${applicant}`, err);
                    throw err;
                }
            }
            try {
                state.onfidoApplicant = yield this.onfidoAPI.applicants.create(props);
                return true;
            }
            catch (err) {
                this.logger.error(`failed to create applicant ${applicant}`, err);
                throw err;
            }
        });
        // public create = async ({ req, state, application, form }) => {
        //   const forms = application.forms.concat(form)
        //   const parsedStubs = getFormsToCreateApplicant(application)
        //   const props = getApplicantProps([form])
        //   return this.onfidoAPI.applicants.update()
        // }
        this.update = ({ req, application, state, form }) => __awaiter(this, void 0, void 0, function* () {
            if (!form) {
                throw new Error(`expected "form"`);
            }
            const props = utils_1.getApplicantProps([form]);
            if (props && Object.keys(props).length) {
                yield this.onfidoAPI.applicants.update(props);
                return true;
            }
            return false;
        });
        this.uploadSelfie = ({ req, application, state, form }) => __awaiter(this, void 0, void 0, function* () {
            utils_1.ensureNoPendingCheck(state);
            if (!form) {
                throw new Error(`expected "form" to be ${constants_2.SELFIE}`);
            }
            const { selfie } = yield this.apiUtils.getResource(form);
            const { mimeType, data } = parseDataUri(selfie.url);
            this.logger.debug('uploading selfie');
            try {
                const result = yield this.onfidoAPI.applicants.uploadLivePhoto(state.onfidoApplicant.id, {
                    file: data,
                    filename: `live-photo-${utils_1.digest(data)}.${utils_1.getExtension(mimeType)}`
                });
                this.logger.debug('uploaded selfie');
                this.apiUtils.setProps(state, { selfie: form });
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
                this.logger.error('upload live photo failed', error);
                return yield this.main.handleOnfidoError({ req, error });
            }
        });
        this.uploadPhotoID = ({ req, application, state, form }) => __awaiter(this, void 0, void 0, function* () {
            utils_1.ensureNoPendingCheck(state);
            if (!form) {
                throw new Error(`expected "form" to be ${constants_2.PHOTO_ID}`);
            }
            const { scan, documentType } = yield this.apiUtils.getResource(form);
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
            this.logger.debug('uploading document');
            try {
                yield this.onfidoAPI.applicants.uploadDocument(state.onfidoApplicant.id, document);
                this.apiUtils.setProps(state, { photoID: form });
                return true;
            }
            catch (error) {
                yield this.main.handleOnfidoError({ req, error });
            }
            return false;
        });
        this.get = (permalink) => __awaiter(this, void 0, void 0, function* () {
            return yield this.apiUtils.getResource({
                type: onfido_models_1.default.state.id,
                permalink
            });
        });
        this.list = (opts) => __awaiter(this, void 0, void 0, function* () {
            return yield this.bot.db.find(Object.assign({}, opts, { filter: {
                    EQ: {
                        [constants_1.TYPE]: onfido_models_1.default.state.id
                    }
                } }));
        });
        this.models = main.models;
        this.productsAPI = main.productsAPI;
        this.bot = main.productsAPI.bot;
        this.onfidoAPI = main.onfidoAPI;
        this.logger = main.logger;
        this.apiUtils = main.apiUtils;
        this.padApplicantName = main.padApplicantName;
    }
}
exports.default = Applicants;
//# sourceMappingURL=applicants.js.map