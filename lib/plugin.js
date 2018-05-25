"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const _ = require("lodash");
const buildResource = require("@tradle/build-resource");
const constants_1 = require("@tradle/constants");
const onfido_models_1 = __importDefault(require("./onfido-models"));
const applicants_1 = __importDefault(require("./applicants"));
const checks_1 = __importDefault(require("./checks"));
const api_utils_1 = __importDefault(require("./api-utils"));
const constants_2 = require("./constants");
const errors_1 = __importDefault(require("./errors"));
const onfido_error_messages_1 = __importDefault(require("./onfido-error-messages"));
const onfido_tradle_mapping_1 = __importDefault(require("./onfido-tradle-mapping"));
const utils = __importStar(require("./utils"));
const { getSelfie, getPhotoID, firstProp, parseReportURL, parseCheckURL, getOnfidoCheckIdKey, parseStub, getLatestFormByType, isApplicantInfoForm, addLinks, validateProductOptions, getFormStubs, getEnumValueId, } = utils;
// const REQUEST_EDITS_FOR = {
//   [APPLICANT]: true,
//   [SELFIE]: true
// }
const RETAKE_SELFIE_MESSAGE = 'Please retake your selfie, centering your face';
class Onfido {
    constructor(opts) {
        this['onmessage:tradle.Form'] = (req) => __awaiter(this, void 0, void 0, function* () {
            const { payload, application } = req;
            if (!application)
                return;
            const { applicant, requestFor } = application;
            const productOpts = this.getProductOptions(requestFor);
            if (!productOpts) {
                this.logger.debug(`ignoring product ${requestFor}`);
                return;
            }
            const form = _.cloneDeep(payload);
            const resolveEmbeds = this.bot.resolveEmbeds(form);
            const checks = yield this.checks.listWithApplication(application._permalink);
            const pending = checks.find(utils.isPendingCheck);
            // nothing can be done until a check completes
            if (pending) {
                this.logger.debug(`check is already pending, ignoring form`, {
                    form: form[constants_1.TYPE],
                    application: application._permalink
                });
                return;
            }
            let props;
            const nonPending = checks.find(utils.isVirginCheck);
            if (nonPending) {
                props = nonPending;
            }
            else {
                props = {
                    reportsOrdered: productOpts.reports.map(id => buildResource.enumValue({
                        model: onfido_models_1.default.reportType,
                        value: id
                    })),
                    application: buildResource.stub({
                        models: this.models,
                        model: this.models[constants_2.APPLICATION],
                        resource: application
                    }),
                    applicant
                };
                if (checks.length) {
                    const latest = _.maxBy(checks, '_time');
                    _.extend(props, _.pick(latest, ['onfidoApplicant']));
                    ['selfie', 'photoID'].forEach(prop => {
                        const stub = latest[prop];
                        if (!stub)
                            return;
                        const parsed = parseStub(stub);
                        const match = application.forms.find(sub => parseStub(sub.submission).link === parsed.link);
                        if (match) {
                            props[prop] = match.submission;
                        }
                    });
                }
            }
            const check = this.bot.draft({
                type: onfido_models_1.default.check.id,
                resource: props
            });
            yield resolveEmbeds;
            yield this.handleForm({ req, application, check, form });
            if (check.isModified()) {
                yield check.signAndSave();
            }
        });
        this.ensureProductSupported = ({ application }) => {
            const { requestFor } = application;
            if (!this.getProductOptions(requestFor)) {
                throw new Error(`missing options for product "${requestFor}"`);
            }
        };
        this.getProductOptions = (productModelId) => {
            return this.products.find(({ product }) => product === productModelId);
        };
        this.handleOnfidoError = ({ req, error }) => __awaiter(this, void 0, void 0, function* () {
            if (error instanceof TypeError || error instanceof SyntaxError || error instanceof ReferenceError) {
                // developer error
                this.logger.error('developer error', error);
                throw error;
            }
            const { body = {}, status = -1 } = error;
            const { type, fields } = body;
            if (!(status === 422 || type === 'validation_error')) {
                this.logger.error('unrecognized onfido error', _.pick(error, ['message', 'stack', 'name']));
                // call this application "submitted"
                // this.onFinished()
                return true;
            }
            this.logger.error('onfido threw validation error:', body);
            let onfidoProp;
            let propInfo;
            for (onfidoProp in fields) {
                if (onfidoProp === 'addresses') {
                    // e.g. "addresses": [{ "postcode": "Invalid postcode" }]
                    onfidoProp = firstProp(fields[onfidoProp][0]);
                }
                propInfo = onfido_error_messages_1.default[onfidoProp];
                if (propInfo)
                    break;
            }
            if (!propInfo)
                throw error;
            const { user, application } = req;
            const form = getFormStubs(application)
                .reverse()
                .find(({ type }) => {
                const mapping = onfido_tradle_mapping_1.default[type];
                return mapping && mapping[onfidoProp];
            });
            if (!form)
                return;
            const formType = form.type;
            if (!this.formsToRequestCorrectionsFor.includes(formType)) {
                this.logger.info(`not configured to request edits for ${formType}`);
                // call this application "submitted"
                return true;
            }
            const tradleProp = onfido_tradle_mapping_1.default[formType][onfidoProp].tradle;
            const message = propInfo.error || errors_1.default.INVALID_VALUE;
            if (formType === constants_2.SELFIE) {
                yield this.applications.requestItem({
                    req,
                    user,
                    application,
                    item: constants_2.SELFIE,
                    message: RETAKE_SELFIE_MESSAGE
                });
                return;
            }
            const prefill = _.omit(yield this.apiUtils.getResource(form, req), constants_1.SIG);
            this.logger.debug(`requesting edit`, {
                form: formType
            });
            yield this.applications.requestEdit({
                req,
                item: prefill,
                details: {
                    errors: [
                        {
                            name: tradleProp,
                            error: message
                        }
                    ]
                }
            });
            return false;
        });
        this.createOnfidoCheck = ({ req, application, check, reports }) => __awaiter(this, void 0, void 0, function* () {
            this.ensureProductSupported({ application });
            if (!reports) {
                ({ reports } = this.getProductOptions(application.requestFor));
            }
            return yield this.checks.create({ req, application, check, reports });
        });
        this.unregisterWebhook = ({ url }) => __awaiter(this, void 0, void 0, function* () {
            yield this.onfidoAPI.webhooks.unregister(url);
            yield this.conf.del(this.webhookKey);
        });
        this.registerWebhook = ({ url, events = constants_2.DEFAULT_WEBHOOK_EVENTS }) => __awaiter(this, void 0, void 0, function* () {
            events.forEach(event => {
                if (!constants_2.ONFIDO_WEBHOOK_EVENTS.includes(event)) {
                    throw new Error(`invalid webhook event: ${event}`);
                }
            });
            this.logger.debug(`registering webhook`, { url });
            const webhook = yield this.onfidoAPI.webhooks.register({ url, events });
            yield this.conf.put(this.webhookKey, webhook);
            return webhook;
        });
        this.getWebhook = () => __awaiter(this, void 0, void 0, function* () {
            return yield this.conf.get(this.webhookKey);
        });
        this.processWebhookEvent = (opts) => __awaiter(this, void 0, void 0, function* () {
            this.logger.debug(`processing webhook event`);
            try {
                yield this._processWebhookEvent(opts);
            }
            catch (err) {
                throw httpError(err.status || 500, 'failed to process webhook event');
            }
        });
        this._processWebhookEvent = ({ req, body, desiredResult }) => __awaiter(this, void 0, void 0, function* () {
            let webhook;
            try {
                webhook = yield this.getWebhook();
            }
            catch (err) {
                this.logger.error('webhook not registered, ignoring event', err);
                throw httpError(400, 'webhook not registered');
            }
            let event;
            try {
                event = yield this.onfidoAPI.webhooks.handleEvent(req, webhook.token, body);
            }
            catch (err) {
                this.logger.error('failed to process webhook event', err);
                const status = /invalid hmac/i.test(err.message)
                    ? 400
                    : 500;
                throw httpError(status, err.message);
            }
            const { resource_type, action, object } = event;
            if (this.apiUtils.isTestMode() && desiredResult) {
                object.result = desiredResult;
            }
            if (!/\.completed?$/.test(action))
                return;
            let checkId;
            let applicantId;
            if (resource_type === 'report') {
                checkId = parseReportURL(object).checkId;
            }
            else if (resource_type === 'check') {
                checkId = object.id;
                // applicantId = parseCheckURL(object).applicantId
            }
            else {
                const msg = 'unknown resource_type: ' + resource_type;
                this.logger.warn(msg);
                throw httpError(400, msg);
            }
            let check;
            try {
                check = yield this.checks.getByCheckId(checkId);
            }
            catch (err) {
                const msg = `check not found`;
                this.logger.warn(`${msg}: ${err.message}`);
                throw httpError(400, msg);
            }
            applicantId = check.get('onfidoApplicant').id;
            const getUpdatedCheck = this.checks.fetchFromOnfido({ applicantId, checkId });
            const getApplication = this.bot.db.get(check.get('application'));
            const [onfidoCheck, application] = yield Promise.all([
                getUpdatedCheck,
                getApplication
            ]);
            this.logger.debug(`updating check from webhook event`, {
                check: check.permalink
            });
            yield this.checks.processCheck({ application, check, onfidoCheck });
        });
        this.handleForm = (opts) => __awaiter(this, void 0, void 0, function* () {
            try {
                yield this._handleForm(opts);
            }
            catch (error) {
                yield this.handleOnfidoError({ req: opts.req, error });
                return;
            }
        });
        this._handleForm = ({ req, application, check, form }) => __awaiter(this, void 0, void 0, function* () {
            const type = form[constants_1.TYPE];
            const onfidoStatus = check.get('onfidoStatus');
            if (onfidoStatus) {
                const onfidoResult = check.get('onfidoResult');
                if (onfidoResult) {
                    this.logger.info(`received ${type} but already have a check complete. Ignoring for now.`);
                }
                else {
                    this.logger.info(`received ${type} but already have a check pending. Ignoring for now.`);
                }
                return;
            }
            const onfidoApplicant = check.get('onfidoApplicant');
            if (onfidoApplicant) {
                const ok = yield this.updateApplicant({ req, application, check, form });
                if (!ok)
                    return;
            }
            else {
                const ok = yield this.applicants.createOrUpdate({ req, application, check, form });
                if (!ok)
                    return;
            }
            const ok = yield this.uploadAttachments({ req, application, check, form });
            if (!ok)
                return;
            if (this.hasRequiredAttachments({ application, check })) {
                yield this.createOnfidoCheck({ req, application, check });
            }
        });
        // private execWithErrorHandler = async (fn, opts):Promise<boolean> => {
        //   const { req } = opts
        //   try {
        //     await fn(opts)
        //     return true
        //   } catch (error) {
        //     await this.handleOnfidoError({ req, error })
        //     return false
        //   }
        // }
        this.updateApplicant = ({ req, application, check, form }) => __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.applicants.update({ req, application, check, form });
                return true;
            }
            catch (error) {
                yield this.handleOnfidoError({ req, error });
                return false;
            }
        });
        this.uploadAttachments = ({ req, application, check, form }) => __awaiter(this, void 0, void 0, function* () {
            const props = this.getRequiredAttachments(application);
            if (props.includes('selfie') && !check.get('selfie')) {
                const selfie = yield this.getForm({ type: constants_2.SELFIE, application, form, req });
                if (selfie) {
                    const ok = yield this.applicants.uploadSelfie({ req, application, check, form: selfie });
                    if (!ok)
                        return false;
                }
            }
            if (props.includes('photoID') && !check.get('photoID')) {
                const photoID = yield this.getForm({ type: constants_2.PHOTO_ID, application, form, req });
                if (photoID) {
                    const ok = yield this.applicants.uploadPhotoID({ req, application, check, form: photoID });
                    if (!ok)
                        return false;
                }
            }
            return true;
        });
        this.sync = () => __awaiter(this, void 0, void 0, function* () {
            yield this.checks.sync();
        });
        this.getForm = ({ type, application, form, req }) => __awaiter(this, void 0, void 0, function* () {
            if (type === form[constants_1.TYPE])
                return form;
            const parsedStub = getLatestFormByType(application, type);
            if (parsedStub) {
                return yield this.apiUtils.getResource(parsedStub, req);
            }
        });
        this.getRequiredAttachments = (application) => {
            const required = {};
            const { reports } = this.getProductOptions(application.requestFor);
            if (reports.includes('facialsimilarity')) {
                required.selfie = true;
            }
            if (reports.includes('document') || reports.includes('identity')) {
                required.photoID = true;
            }
            return Object.keys(required);
        };
        this.hasRequiredAttachments = ({ application, check }) => {
            const required = this.getRequiredAttachments(application);
            return required.every(prop => check.get(prop));
        };
        const { logger, onfidoAPI, bot, products, applications, padApplicantName, formsToRequestCorrectionsFor = [], preCheckAddress, webhookKey = constants_2.DEFAULT_WEBHOOK_KEY
        // onFinished
         } = opts;
        this.logger = logger;
        this.onfidoAPI = onfidoAPI;
        this.applications = applications;
        products.forEach(validateProductOptions);
        this.products = products.map(opts => {
            return Object.assign({}, opts, { reports: opts.reports || constants_2.DEFAULT_REPORTS });
        });
        this.bot = bot;
        this.conf = this.bot.conf.sub('onfido');
        this.padApplicantName = padApplicantName;
        this.formsToRequestCorrectionsFor = formsToRequestCorrectionsFor;
        this.preCheckAddress = preCheckAddress;
        this.webhookKey = webhookKey;
        // this.onFinished = onFinished
        this.apiUtils = new api_utils_1.default(this);
        this.applicants = new applicants_1.default(this);
        this.checks = new checks_1.default(this);
    }
    get models() {
        return this.bot.models;
    }
}
exports.default = Onfido;
exports.Onfido = Onfido;
const getStateKey = application => {
    return `${constants_2.APPLICATION}_${application._permalink}_onfidoState`;
};
const httpError = (status, message) => {
    debugger;
    const err = new Error(message);
    err.status = status;
    return err;
};
//# sourceMappingURL=plugin.js.map