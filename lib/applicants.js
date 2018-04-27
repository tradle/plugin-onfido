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
const _ = require("lodash");
const parseDataUri = require("parse-data-uri");
const utils_1 = require("./utils");
const constants_1 = require("./constants");
class Applicants {
    constructor(main) {
        this.createOrUpdate = ({ req, application, state, form }) => __awaiter(this, void 0, void 0, function* () {
            if (!state) {
                throw new Error('expected "state"');
            }
            const productOptions = this.main.getProductOptions(application.requestFor);
            const fStub = form && this.apiUtils.stub(form);
            const parsedStubs = utils_1.getFormsToCreateApplicant({
                forms: utils_1.getFormStubs(application).concat(fStub ? utils_1.parseStub(fStub) : []),
                reports: productOptions.reports
            });
            if (!parsedStubs) {
                this.logger.debug(`don't have the requisite forms to create an applicant`);
                return false;
            }
            const parsedStubsAndForms = parsedStubs.slice();
            const forms = yield Promise.all(parsedStubsAndForms.map(item => this.apiUtils.getResource(item, req)));
            const props = utils_1.getApplicantProps(forms);
            const { first_name, last_name, dob, addresses = [] } = props;
            const needAddress = productOptions.reports.includes('identity');
            if (!(first_name && last_name && dob && (addresses.length || !needAddress))) {
                return false;
            }
            if (addresses.length && this.preCheckAddress) {
                yield this.apiUtils.checkAddress({ address: addresses[0] });
            }
            const applicant = utils_1.parseStub(application.applicant).permalink;
            // to ensure uniqueness during testing
            if (this.padApplicantName) {
                props.last_name += applicant.slice(0, 4);
            }
            if (state.onfidoApplicant) {
                return yield this.update({ req, application, state, props });
            }
            try {
                const onfidoApplicant = yield this.onfidoAPI.applicants.create(props);
                state.onfidoApplicant = utils_1.sanitize(onfidoApplicant).sanitized;
                this.apiUtils.setProps(state, {
                    applicantDetails: parsedStubs.map(utils_1.stubFromParsedStub)
                });
                return true;
            }
            catch (err) {
                this.logger.error(`failed to create applicant ${applicant}`, err);
                throw err;
            }
        });
        this.update = ({ req, application, state, form, props }) => __awaiter(this, void 0, void 0, function* () {
            if (!props) {
                if (!form) {
                    throw new Error('expected "form" or "props');
                }
                props = utils_1.getApplicantProps([form]);
            }
            if (props) {
                const current = state.onfidoApplicant;
                if (hasUpdate({ current, update: props })) {
                    yield this.onfidoAPI.applicants.update(current.id, props);
                }
                return true;
            }
            return false;
        });
        this.uploadSelfie = ({ req, application, state, form }) => __awaiter(this, void 0, void 0, function* () {
            utils_1.ensureNoPendingCheck(state);
            if (!form) {
                throw new Error(`expected "form" to be ${constants_1.SELFIE}`);
            }
            const { selfie } = form;
            const { mimeType, data } = parseDataUri(selfie.url);
            this.logger.debug('uploading selfie');
            try {
                const result = yield this.onfidoAPI.applicants.uploadLivePhoto(state.onfidoApplicant.id, {
                    file: data,
                    filename: `live-photo-${utils_1.digest(data)}.${utils_1.getExtension(mimeType)}`
                });
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