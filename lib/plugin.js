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
const buildResource = require("@tradle/build-resource");
const constants_1 = require("@tradle/constants");
const models_1 = require("./models");
const onfido_models_1 = require("./onfido-models");
const applicants_1 = require("./applicants");
const checks_1 = require("./checks");
const api_utils_1 = require("./api-utils");
const constants_2 = require("./constants");
const errors_1 = require("./errors");
const onfido_error_messages_1 = require("./onfido-error-messages");
const onfido_tradle_mapping_1 = require("./onfido-tradle-mapping");
const utils_1 = require("./utils");
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
            if (!this.getProductOptions(requestFor)) {
                this.logger.debug(`ignoring product ${requestFor}`);
                return;
            }
            let state;
            let fresh;
            try {
                const mapping = yield this.getStatePointer({ application });
                state = yield this.apiUtils.getResource({
                    type: onfido_models_1.default.state.id,
                    permalink: mapping.state
                });
            }
            catch (err) {
                if (err.name !== 'NotFound')
                    throw err;
                fresh = true;
                state = buildResource({
                    models: models_1.default,
                    model: onfido_models_1.default.state,
                })
                    .set({
                    application,
                    applicant
                })
                    .toJSON();
                // yes, we might have to re-sign later
                // but if we don't, we won't be able to point to the state object
                state = yield this.bot.sign(state);
                utils_1.addLinks(state);
            }
            const type = payload[constants_1.TYPE];
            let copy = _.cloneDeep(state);
            const { check } = state;
            // nothing can be done until a check completes
            if (check) {
                this.logger.debug(`check is already pending, ignoring ${type}`);
                return;
            }
            yield this.handleForm({ req, application, state, form: payload });
            if (fresh) {
                yield Promise.all([
                    this.putStatePointer({ application, state }),
                    this.bot.save(state)
                ]);
            }
            else if (!_.isEqual(state, copy)) {
                yield this.bot.versionAndSave(state);
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
        this.putStatePointer = ({ application, state }) => __awaiter(this, void 0, void 0, function* () {
            yield this.bot.kv.put(getStateKey(application), { state: state._permalink });
        });
        this.getStatePointer = ({ application }) => __awaiter(this, void 0, void 0, function* () {
            return yield this.bot.kv.get(getStateKey(application));
        });
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
                    onfidoProp = utils_1.firstProp(fields[onfidoProp][0]);
                }
                propInfo = onfido_error_messages_1.default[onfidoProp];
                if (propInfo)
                    break;
            }
            if (!propInfo)
                throw error;
            const { user, application } = req;
            const form = application.forms.slice().reverse().map(utils_1.parseStub).find(({ type }) => {
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
                yield this.productsAPI.requestItem({
                    req,
                    user,
                    application,
                    item: constants_2.SELFIE,
                    message: RETAKE_SELFIE_MESSAGE
                });
                return;
            }
            const prefill = _.omit(yield this.apiUtils.getResource(form, req), constants_1.SIG);
            this.logger.debug(`requesting edit of ${formType}`);
            yield this.productsAPI.requestEdit({
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
        this.createCheck = ({ req, application, state, saveState, reports }) => __awaiter(this, void 0, void 0, function* () {
            this.ensureProductSupported({ application });
            if (!state[constants_1.SIG]) {
                state = yield this.bot.sign(state);
            }
            if (!reports) {
                ({ reports } = this.getProductOptions(application.requestFor));
            }
            try {
                return yield this.checks.create({ req, application, state, reports, saveState });
            }
            finally {
                yield this.bot.save(state);
            }
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
            const webhook = yield this.onfidoAPI.webhooks.register({ url, events });
            yield this.conf.put(this.webhookKey, webhook);
            return webhook;
        });
        this.getWebhook = () => __awaiter(this, void 0, void 0, function* () {
            return yield this.conf.get(this.webhookKey);
        });
        this.processWebhookEvent = ({ req, body, desiredResult }) => __awaiter(this, void 0, void 0, function* () {
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
                checkId = utils_1.parseReportURL(object).checkId;
            }
            else if (resource_type === 'check') {
                checkId = object.id;
                applicantId = utils_1.parseCheckURL(object).applicantId;
            }
            else {
                const msg = 'unknown resource_type: ' + resource_type;
                this.logger.warn(msg);
                throw httpError(400, msg);
            }
            const loadSavedData = this.checks.lookupByCheckId(checkId);
            const getApplicantId = applicantId
                ? Promise.resolve(applicantId)
                : loadSavedData.then(({ state }) => state.onfidoApplicant.id);
            const getUpdatedCheck = this.checks.fetch({
                applicantId: yield getApplicantId,
                checkId
            });
            const [savedData, update] = yield Promise.all([
                loadSavedData,
                getUpdatedCheck
            ]);
            const { application, state, check } = savedData;
            yield this.checks.processCheck({
                application,
                state,
                current: check,
                update,
                saveState: true
            });
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
        this._handleForm = ({ req, application, state, form }) => __awaiter(this, void 0, void 0, function* () {
            const type = form[constants_1.TYPE];
            const { pendingCheck, onfidoApplicant, selfie, photoID } = state;
            if (pendingCheck) {
                const { result } = state;
                if (result) {
                    this.logger.info(`received ${type} but already have a check complete. Ignoring for now.`);
                }
                else {
                    this.logger.info(`received ${type} but already have a check pending. Ignoring for now.`);
                }
                return;
            }
            if (onfidoApplicant) {
                const ok = yield this.updateApplicant({ req, application, state, form });
                if (!ok)
                    return;
            }
            else {
                const ok = yield this.applicants.createOrUpdate({ req, application, state, form });
                if (!ok)
                    return;
            }
            yield this.uploadAttachments({ req, application, state, form });
            if (state.photoID && state.selfie) {
                yield this.createCheck({ req, application, state, saveState: false });
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
        this.updateApplicant = ({ req, application, state, form }) => __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.applicants.update({ req, application, state, form });
                return true;
            }
            catch (error) {
                yield this.handleOnfidoError({ req, error });
                return false;
            }
        });
        this.uploadAttachments = ({ req, application, state, form }) => __awaiter(this, void 0, void 0, function* () {
            if (!state.selfie) {
                const selfie = yield this.getForm({ type: constants_2.SELFIE, application, form, req });
                if (selfie) {
                    const ok = yield this.applicants.uploadSelfie({ req, application, state, form: selfie });
                    if (!ok)
                        return false;
                }
            }
            if (!state.photoID) {
                const photoID = yield this.getForm({ type: constants_2.PHOTO_ID, application, form, req });
                if (photoID) {
                    const ok = yield this.applicants.uploadPhotoID({ req, application, state, form: photoID });
                    if (!ok)
                        return false;
                }
            }
            return true;
        });
        this.getState = (permalink) => __awaiter(this, void 0, void 0, function* () {
            return yield this.apiUtils.getResource({
                type: onfido_models_1.default.state.id,
                permalink
            });
        });
        this.listStates = (opts) => __awaiter(this, void 0, void 0, function* () {
            return yield this.bot.db.find(Object.assign({}, opts, { filter: {
                    EQ: {
                        [constants_1.TYPE]: onfido_models_1.default.state.id
                    }
                } }));
        });
        this.sync = () => __awaiter(this, void 0, void 0, function* () {
            yield this.checks.sync();
        });
        this.getForm = ({ type, application, form, req }) => __awaiter(this, void 0, void 0, function* () {
            if (type === form[constants_1.TYPE])
                return form;
            const parsedStub = utils_1.getLatestFormByType(application, type);
            if (parsedStub) {
                return yield this.apiUtils.getResource(parsedStub, req);
            }
        });
        const { logger, onfidoAPI, bot, products, productsAPI, padApplicantName, formsToRequestCorrectionsFor = [], preCheckAddress, webhookKey = constants_2.DEFAULT_WEBHOOK_KEY
        // onFinished
         } = opts;
        this.logger = logger;
        this.onfidoAPI = onfidoAPI;
        products.forEach(utils_1.validateProductOptions);
        this.products = products.map(opts => {
            return Object.assign({}, opts, { reports: opts.reports || constants_2.DEFAULT_REPORTS });
        });
        this.productsAPI = productsAPI;
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
    const err = new Error('message');
    err.status = status;
    return err;
};
//# sourceMappingURL=plugin.js.map