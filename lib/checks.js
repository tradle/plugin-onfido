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
Object.defineProperty(exports, "__esModule", { value: true });
const _ = require("lodash");
const buildResource = require("@tradle/build-resource");
const constants_1 = require("@tradle/constants");
const onfido_models_1 = __importDefault(require("./onfido-models"));
const utils_1 = require("./utils");
const enum_value_map_1 = require("./enum-value-map");
const CHECK_SYNC_BATCH_SIZE = 10;
const { reportType } = onfido_models_1.default;
const REPORT_TYPE_TO_ONFIDO_NAME = {
    document: {
        name: 'document'
    },
    facialsimilarity: {
        name: 'facial_similarity'
    },
    identity: {
        name: 'identity',
        variant: 'kyc'
    }
};
// const ONFIDO_STATUS_TO_STATUS {
//   in_progress: 'pending',
//   withdrawn: 'canceled',
// }
class Checks {
    constructor(main) {
        this.create = ({ req, application, check, reports }) => __awaiter(this, void 0, void 0, function* () {
            utils_1.ensureNoPendingCheck(check);
            if (!check.get('onfidoApplicant')) {
                throw new Error('expected "onfidoApplicant" to have been created already');
            }
            if (!reports.length) {
                throw new Error('expected check to have at least one report');
            }
            reports.forEach(report => {
                if (!reportType.enum.find(({ id }) => id === report)) {
                    throw new Error(`invalid report type: ${report}, expected one of: ${reportType.enum.join(', ')}`);
                }
            });
            const onfidoCheck = yield this.onfidoAPI.checks.create(check.get('onfidoApplicant').id, {
                reports: reports.map(name => REPORT_TYPE_TO_ONFIDO_NAME[name])
            });
            yield this.processCheck({
                req,
                application,
                check,
                onfidoCheck
            });
        });
        this.processReport = ({ req, application, check, report }) => __awaiter(this, void 0, void 0, function* () {
            if (!(application && check)) {
                throw new Error('expected "application" and "check"');
            }
            // ({ application, state, check } = await this.loadStateAppAndCheck({
            //   application,
            //   state,
            //   check,
            //   report
            // }))
            const rawData = _.cloneDeep(check.get('rawData'));
            const idx = rawData.reports.findIndex(r => r.id === report.id);
            rawData.reports[idx] = report;
            check.set({ rawData });
            // const { reportsResults=[] } = check
            // const idx = reportsResults.findIndex(r => r.id === report.id)
            // if (idx === -1) {
            //   reportsResults.push(report)
            // } else {
            //   reportsResults[idx] = report
            // }
            // check.reportsResults = reportsResults
            if (report.status === 'complete') {
                yield this.processCompletedReport({ req, application, check, report });
            }
        });
        this.processCheck = ({ req, application, check, onfidoCheck }) => __awaiter(this, void 0, void 0, function* () {
            onfidoCheck = this.apiUtils.sanitize(onfidoCheck);
            if (!(application && check && onfidoCheck)) {
                throw new Error('expected "application", "check" and "onfidoCheck');
            }
            const prevOnfidoCheck = check.get('rawData');
            const applicant = check.get('applicant');
            const { status, result, id } = onfidoCheck;
            const newCheckProps = {
                onfidoCheckId: id,
                onfidoStatus: enum_value_map_1.fromOnfido[status] || status,
                rawData: onfidoCheck,
            };
            if (result) {
                newCheckProps.onfidoResult = result;
            }
            check.set(newCheckProps);
            if (utils_1.isComplete(onfidoCheck)) {
                this.logger.info(`check for ${applicant._permalink} completed with result: ${result}`);
            }
            else {
                this.logger.debug(`check for ${applicant._permalink} status: ${status}`);
            }
            const reports = utils_1.getCompletedReports({
                current: prevOnfidoCheck,
                update: onfidoCheck
            });
            if (reports.length) {
                const appCopy = _.cloneDeep(application);
                yield Promise.all(reports.map(report => {
                    return this.processReport({ req, application, check, report });
                }));
            }
            if (check.isModified()) {
                yield check.signAndSave();
            }
            else {
                this.logger.debug(`check hasn't changed, ignoring update`);
            }
        });
        this.processCompletedReport = ({ req, application, check, report }) => __awaiter(this, void 0, void 0, function* () {
            const { applicant, applicantDetails, selfie, photoID } = check.toJSON({ validate: false });
            const type = report.name;
            const applicantPermalink = utils_1.parseStub(applicant).permalink;
            this.logger.debug('report complete', {
                applicant: applicantPermalink,
                type,
                result: report.result
            });
            let stubs = [];
            if (type === 'document') {
                stubs.push(photoID);
            }
            else if (type === 'facial_similarity') {
                stubs.push(selfie);
            }
            else if (type === 'identity') {
                stubs.push(...applicantDetails);
            }
            else {
                this.logger.error('unknown report type: ' + type, report);
                return;
            }
            if (report.result !== 'clear')
                return;
            yield Promise.all(stubs.map((stub) => __awaiter(this, void 0, void 0, function* () {
                this.logger.debug('creating verification for', {
                    applicant: applicantPermalink,
                    form: stub
                });
                const verification = utils_1.createOnfidoVerification({
                    applicant,
                    report,
                    form: yield this.apiUtils.getResource(stub, req)
                });
                return yield this.applications.createVerification({
                    req,
                    application,
                    verification
                });
            })));
        });
        this.fetchFromOnfido = ({ applicantId, checkId }) => __awaiter(this, void 0, void 0, function* () {
            this.logger.debug(`looking up check ${checkId} for applicant ${applicantId}`);
            return yield this.onfidoAPI.checks.get({
                applicantId,
                checkId,
                expandReports: true
            });
        });
        this.list = () => __awaiter(this, void 0, void 0, function* () {
            return yield this._list({
                filter: {
                    EQ: {
                        [constants_1.TYPE]: onfido_models_1.default.check.id
                    }
                }
            });
        });
        this.getByCheckId = (checkId) => __awaiter(this, void 0, void 0, function* () {
            const check = yield this.bot.db.findOne({
                filter: {
                    EQ: {
                        [constants_1.TYPE]: onfido_models_1.default.check.id,
                        onfidoCheckId: checkId
                    }
                }
            });
            return this.bot.draft({ resource: check });
        });
        this.listWithApplication = (permalink) => __awaiter(this, void 0, void 0, function* () {
            return yield this._list({
                filter: {
                    EQ: {
                        [constants_1.TYPE]: onfido_models_1.default.check.id,
                        'application._permalink': permalink
                    }
                }
            });
        });
        this.listWithStatus = (status) => __awaiter(this, void 0, void 0, function* () {
            return yield this._list({
                filter: {
                    EQ: {
                        [constants_1.TYPE]: onfido_models_1.default.check.id
                    },
                    IN: {
                        status: [].concat(status).map(value => buildResource.enumValue({
                            model: onfido_models_1.default.checkStatus,
                            value
                        }))
                    }
                }
            });
        });
        this.listPending = () => this.listWithStatus(['inprogress', 'paused', 'reopened']);
        this.listCompleted = () => this.listWithStatus(['complete']);
        this.listWithdrawn = () => this.listWithStatus(['withdrawn']);
        this.sync = () => __awaiter(this, void 0, void 0, function* () {
            const pending = yield this.listPending();
            const batches = _.chunk(pending, CHECK_SYNC_BATCH_SIZE);
            const processOne = (current) => __awaiter(this, void 0, void 0, function* () {
                const update = yield this.fetchFromOnfido(current);
                const status = enum_value_map_1.fromOnfido[update.status] || update.status;
                if (status === current.status)
                    return;
                const check = yield this.getByCheckId(current.checkId);
                const application = this.bot.db.get(check.get('application'));
                yield this.processCheck({ application, check, onfidoCheck: update });
            });
            for (const batch of batches) {
                yield Promise.all(batch.map(processOne));
            }
        });
        this._list = (opts) => __awaiter(this, void 0, void 0, function* () {
            const { items } = yield this.bot.db.find(opts);
            return items;
        });
        this.applications = main.applications;
        this.bot = main.bot;
        this.onfidoAPI = main.onfidoAPI;
        this.logger = main.logger;
        this.apiUtils = main.apiUtils;
    }
}
exports.default = Checks;
const getCheckKey = checkId => `onfido_check_${checkId}`;
//# sourceMappingURL=checks.js.map