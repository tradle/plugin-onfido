"use strict";
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
const models_1 = __importDefault(require("./models"));
const onfido_models_1 = __importDefault(require("./onfido-models"));
const applicants_1 = __importDefault(require("./applicants"));
const checks_1 = __importDefault(require("./checks"));
const onfido_tradle_mapping_1 = __importDefault(require("./onfido-tradle-mapping"));
const Extractor = __importStar(require("./extractor"));
const api_utils_1 = __importDefault(require("./api-utils"));
const constants_2 = require("./constants");
const errors_1 = __importDefault(require("./errors"));
const onfido_error_messages_1 = __importDefault(require("./onfido-error-messages"));
const onfido_tradle_mapping_2 = __importDefault(require("./onfido-tradle-mapping"));
const utils = __importStar(require("./utils"));
const { getSelfie, getPhotoID, firstProp, parseReportURL, parseCheckURL, getOnfidoCheckIdKey, parseStub, getLatestFormByType, isApplicantInfoForm, addLinks, validateProductOptions, getFormStubs, getEnumValueId, } = utils;
// const REQUEST_EDITS_FOR = {
//   [APPLICANT]: true,
//   [SELFIE]: true
// }
const RETAKE_SELFIE_MESSAGE = 'Please retake your selfie, centering your face';
const ONFIDO_WEBHOOK_CONTEXT = {
    provider: 'onfido'
};
class Onfido {
    constructor(opts) {
        this.onFormsCollected = async ({ req }) => {
            if (this.mode !== 'after')
                return;
            const { payload, application } = req;
            if (!application)
                return;
            const { applicant, requestFor } = application;
            const productOpts = this.getProductOptions(requestFor);
            if (!productOpts)
                return;
            const checks = await this.checks.listWithApplication(application._permalink);
            const pending = checks.find(utils.isPendingCheck);
            // nothing can be done until a check completes
            if (pending) {
                this.logger.debug(`check is already pending, exiting`);
                return;
            }
            // let relevant = application.forms
            //   .map(appSub => appSub.submission)
            //   .map(parseStub)
            //   .filter(({ type }) => !this.shouldIgnoreForm({ product: requestFor, form: type }))
            // relevant = _.uniqBy(relevant, ({ permalink }) => permalink)
            // const forms = await Promise.all(relevant.map(form => this.bot.getResource(form)))
            this.bot.sendSimpleMessage({
                to: req.user,
                message: 'Give me a moment...'
            });
            const check = this.draftCheck({ application, checks });
            await this.updateCheck({ req, application, check });
        };
        this.updateCheck = async ({ req, application, check, form }) => {
            const onfidoApplicant = check.get('onfidoApplicant');
            const updatedApplicant = await this.applicants.createOrUpdate({ req, application, check, form });
            if (!updatedApplicant)
                return;
            const uploadedAttachments = await this.uploadAttachments({ req, application, check, form });
            if (!uploadedAttachments)
                return;
            if (this.hasRequiredAttachments({ application, check })) {
                await this.createOnfidoCheck({ req, application, check });
            }
            if (check.isModified()) {
                await check.signAndSave();
            }
        };
        this.draftCheck = ({ application, checks }) => {
            let props;
            const nonPending = checks.find(utils.isVirginCheck);
            if (nonPending) {
                props = nonPending;
            }
            else {
                const { reports } = this.getProductOptions(application.requestFor);
                props = {
                    reportsOrdered: reports.map(id => buildResource.enumValue({
                        model: onfido_models_1.default.reportType,
                        value: id
                    })),
                    application: buildResource.stub({
                        models: models_1.default,
                        model: models_1.default[constants_2.APPLICATION],
                        resource: application
                    }),
                    applicant: application.applicant
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
            return this.bot.draft({
                type: onfido_models_1.default.check.id,
                resource: props
            });
        };
        this['onmessage:tradle.Form'] = async (req) => {
            if (this.mode !== 'during')
                return;
            const { payload, application } = req;
            if (!application)
                return;
            const { applicant, requestFor } = application;
            if (this.shouldIgnoreForm({ product: requestFor, form: payload[constants_1.TYPE] })) {
                return;
            }
            const form = _.cloneDeep(payload);
            const resolveEmbeds = this.bot.resolveEmbeds(form);
            const checks = await this.checks.listWithApplication(application._permalink);
            const pending = checks.find(utils.isPendingCheck);
            // nothing can be done until a check completes
            if (pending) {
                this.logger.debug(`check is already pending, ignoring form`, {
                    form: form[constants_1.TYPE],
                    application: application._permalink
                });
                return;
            }
            const check = this.draftCheck({ application, checks });
            await resolveEmbeds;
            await this.handleForm({ req, application, check, form });
        };
        this.ensureProductSupported = ({ application }) => {
            const { requestFor } = application;
            if (!this.getProductOptions(requestFor)) {
                throw new Error(`missing options for product "${requestFor}"`);
            }
        };
        this.getProductOptions = (productModelId) => {
            return this.products.find(({ product }) => product === productModelId);
        };
        this.handleOnfidoError = async ({ req, error }) => {
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
                const mapping = onfido_tradle_mapping_2.default[type];
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
            const tradleProp = onfido_tradle_mapping_2.default[formType][onfidoProp].tradle;
            const message = propInfo.error || errors_1.default.INVALID_VALUE;
            if (formType === constants_2.SELFIE) {
                await this.applications.requestItem({
                    req,
                    user,
                    application,
                    item: constants_2.SELFIE,
                    message: RETAKE_SELFIE_MESSAGE
                });
                return;
            }
            const prefill = _.omit(await this.apiUtils.getResource(form, req), constants_1.SIG);
            this.logger.debug(`requesting edit`, {
                form: formType
            });
            await this.applications.requestEdit({
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
        };
        this.createOnfidoCheck = async ({ req, application, check, reports }) => {
            this.ensureProductSupported({ application });
            if (!reports) {
                ({ reports } = this.getProductOptions(application.requestFor));
            }
            return await this.checks.create({ req, application, check, reports });
        };
        this.unregisterWebhook = async ({ url }) => {
            await this.onfidoAPI.webhooks.unregister(url);
            await this.secrets.del({ key: this.webhookKey, context: ONFIDO_WEBHOOK_CONTEXT });
        };
        this.registerWebhook = async ({ url, events = constants_2.DEFAULT_WEBHOOK_EVENTS }) => {
            events.forEach(event => {
                if (!constants_2.ONFIDO_WEBHOOK_EVENTS.includes(event)) {
                    throw new Error(`invalid webhook event: ${event}`);
                }
            });
            const existing = await this.onfidoAPI.webhooks.list();
            let webhook;
            if (existing) {
                webhook = existing.webhooks.find(w => {
                    return w.url === url && events.every(e => w.events.includes(e));
                });
                if (webhook) {
                    this.logger.debug('not registering, found existing', { id: webhook.id });
                }
            }
            if (!webhook) {
                this.logger.debug(`registering webhook`, { url });
                webhook = await this.onfidoAPI.webhooks.register({ url, events });
            }
            await this.secrets.update({
                key: this.webhookKey,
                value: webhook,
                context: ONFIDO_WEBHOOK_CONTEXT
            });
            return webhook;
        };
        this.getWebhook = async () => {
            const webhook = await this.secrets.get({
                key: this.webhookKey,
                context: ONFIDO_WEBHOOK_CONTEXT
            });
            if (typeof webhook === 'string' || Buffer.isBuffer(webhook)) {
                // @ts-ignore
                return JSON.parse(webhook);
            }
            return webhook;
        };
        this.processWebhookEvent = async (opts) => {
            this.logger.debug(`processing webhook event`);
            try {
                await this._processWebhookEvent(opts);
            }
            catch (err) {
                throw httpError(err.status || 500, 'failed to process webhook event');
            }
        };
        this._processWebhookEvent = async ({ req, body, desiredResult }) => {
            let webhook;
            try {
                webhook = await this.getWebhook();
            }
            catch (err) {
                this.logger.error('webhook not registered, ignoring event', err);
                throw httpError(400, 'webhook not registered');
            }
            let event;
            try {
                event = await this.onfidoAPI.webhooks.handleEvent(req, webhook.token, body);
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
                check = await this.checks.getByCheckId(checkId);
            }
            catch (err) {
                const msg = `check not found`;
                this.logger.warn(`${msg}: ${err.message}`);
                throw httpError(400, msg);
            }
            applicantId = check.get('onfidoApplicant').id;
            const getUpdatedCheck = this.checks.fetchFromOnfido({ applicantId, checkId });
            const getApplication = this.bot.db.get(check.get('application'));
            const [onfidoCheck, application] = await Promise.all([
                getUpdatedCheck,
                getApplication
            ]);
            this.logger.debug(`updating check from webhook event`, {
                check: check.permalink
            });
            await this.checks.processCheck({ application, check, onfidoCheck });
        };
        this.handleForm = async (opts) => {
            try {
                await this._handleForm(opts);
            }
            catch (error) {
                await this.handleOnfidoError({ req: opts.req, error });
                return;
            }
        };
        this._handleForm = async ({ req, application, check, form }) => {
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
            await this.updateCheck({ req, application, check, form });
        };
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
        this.updateApplicant = async ({ req, application, check, form }) => {
            try {
                await this.applicants.update({ req, application, check, form });
                return true;
            }
            catch (error) {
                await this.handleOnfidoError({ req, error });
                return false;
            }
        };
        this.uploadAttachments = async ({ req, application, check, form }) => {
            const props = this.getRequiredAttachments(application);
            if (props.includes('selfie') && !check.get('selfie')) {
                const selfie = await this.getForm({ type: constants_2.SELFIE, application, form, req });
                if (selfie) {
                    const ok = await this.applicants.uploadSelfie({ req, application, check, form: selfie });
                    if (!ok)
                        return false;
                }
            }
            if (props.includes('photoID') && !check.get('photoID')) {
                const photoID = await this.getForm({ type: constants_2.PHOTO_ID, application, form, req });
                if (photoID) {
                    const ok = await this.applicants.uploadPhotoID({ req, application, check, form: photoID });
                    if (!ok)
                        return false;
                }
            }
            return true;
        };
        this.sync = async () => {
            await this.checks.sync();
        };
        this.getForm = async ({ type, application, form, req }) => {
            if (form && type === form[constants_1.TYPE])
                return form;
            const parsedStub = getLatestFormByType(application, type);
            if (parsedStub) {
                return await this.apiUtils.getResource(parsedStub, req);
            }
        };
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
        this.shouldIgnoreForm = ({ product, form }) => {
            const productOpts = this.getProductOptions(product);
            if (!productOpts) {
                // this.logger.debug(`ignoring form for product`, { product, form })
                return true;
            }
            if (!onfido_tradle_mapping_1.default[form]) {
                // this.logger.debug(`ignoring form with no extractable data`, { product, form })
                return true;
            }
            if (!utils.isAddressRequired(productOpts.reports)) {
                const extractor = Extractor.byForm[form] || {};
                if (_.isEqual(Object.keys(extractor), ['address'])) {
                    // this.logger.debug('address-related reports disabled, ignoring address-related form', {
                    //   product,
                    //   form
                    // })
                    return true;
                }
            }
        };
        const { mode = 'after', logger, onfidoAPI, bot, products, applications, padApplicantName, formsToRequestCorrectionsFor = [], preCheckAddress, webhookKey = constants_2.DEFAULT_WEBHOOK_KEY
        // onFinished
         } = opts;
        this.mode = mode;
        this.logger = logger;
        this.onfidoAPI = onfidoAPI;
        this.applications = applications;
        products.forEach(validateProductOptions);
        this.products = products.map(opts => {
            return Object.assign({}, opts, { reports: opts.reports || constants_2.DEFAULT_REPORTS });
        });
        this.bot = bot;
        this.secrets = this.bot.secrets;
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
    const err = new Error(message);
    err.status = status;
    return err;
};
//# sourceMappingURL=plugin.js.map