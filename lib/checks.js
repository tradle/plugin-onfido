"use strict";
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
        this.create = async ({ req, application, check, reports }) => {
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
            this.logger.debug(`creating check`, {
                application: application._permalink
            });
            const onfidoCheck = await this.onfidoAPI.checks.create(check.get('onfidoApplicant').id, {
                reports: reports.map(name => REPORT_TYPE_TO_ONFIDO_NAME[name])
            });
            check.set({ dateChecked: Date.now() });
            await this.processCheck({
                req,
                application,
                check,
                onfidoCheck
            });
        };
        this.processReport = async ({ req, application, check, report }) => {
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
                await this.processCompletedReport({ req, application, check, report });
            }
        };
        this.processCheck = async ({ req, application, check, onfidoCheck }) => {
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
                newCheckProps.status = utils_1.getStatus(result);
                const reportsOrdered = check.get('reportsOrdered').map(utils_1.getEnumValueId);
                newCheckProps.message = utils_1.getMessageForReports(reportsOrdered, newCheckProps.status);
            }
            check.set(newCheckProps);
            this.logger.debug(`check status update: ${status}`, {
                application: application._permalink
            });
            const reports = utils_1.getCompletedReports({
                current: prevOnfidoCheck,
                update: onfidoCheck
            });
            if (reports.length) {
                const appCopy = _.cloneDeep(application);
                await Promise.all(reports.map(report => {
                    return this.processReport({ req, application, check, report });
                }));
            }
            if (check.isModified()) {
                await check.signAndSave();
            }
            else {
                this.logger.debug(`check hasn't changed, ignoring update`, {
                    application: application._permalink
                });
            }
        };
        this.processCompletedReport = async ({ req, application, check, report }) => {
            const { applicant, applicantDetails, selfie, photoID } = check.toJSON({ validate: false });
            const type = report.name;
            this.logger.debug('report complete', {
                application: application._permalink,
                type,
                result: report.result
            });
            let stubs = [];
            if (type === 'document') {
                stubs.push(photoID);
            }
            else if (type === 'facial_similarity') {
                stubs.push(selfie);
                if (report.result === 'clear') {
                    const { score } = report.properties;
                    if (score != null) {
                        check.set('faceMatchConfidence', score);
                    }
                }
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
            await Promise.all(stubs.map(async (stub) => {
                this.logger.debug('creating verification for', {
                    application: application._permalink,
                    form: this.apiUtils.toStableStub(stub)
                });
                const verification = utils_1.createOnfidoVerification({
                    applicant,
                    report,
                    form: await this.apiUtils.getResource(stub, req)
                });
                return await this.applications.createVerification({
                    req,
                    application,
                    verification
                });
            }));
        };
        this.fetchFromOnfido = async ({ applicantId, checkId }) => {
            this.logger.debug(`looking up check`, { checkId, applicantId });
            return await this.onfidoAPI.checks.get({
                applicantId,
                checkId,
                expandReports: true
            });
        };
        this.list = async () => {
            return await this._list({
                filter: {
                    EQ: {
                        [constants_1.TYPE]: onfido_models_1.default.check.id
                    }
                }
            });
        };
        this.getByCheckId = async (checkId) => {
            const check = await this.bot.db.findOne({
                filter: {
                    EQ: {
                        [constants_1.TYPE]: onfido_models_1.default.check.id,
                        onfidoCheckId: checkId
                    }
                }
            });
            return this.bot.draft({ resource: check });
        };
        this.listWithApplication = async (permalink) => {
            return await this._list({
                filter: {
                    EQ: {
                        [constants_1.TYPE]: onfido_models_1.default.check.id,
                        'application._permalink': permalink
                    }
                }
            });
        };
        this.listWithStatus = async (status) => {
            return await this._list({
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
        };
        this.listPending = () => this.listWithStatus(['inprogress', 'paused', 'reopened']);
        this.listCompleted = () => this.listWithStatus(['complete']);
        this.listWithdrawn = () => this.listWithStatus(['withdrawn']);
        this.sync = async () => {
            const pending = await this.listPending();
            const batches = _.chunk(pending, CHECK_SYNC_BATCH_SIZE);
            const processOne = async (current) => {
                const update = await this.fetchFromOnfido(current);
                const status = enum_value_map_1.fromOnfido[update.status] || update.status;
                if (status === current.status)
                    return;
                const check = await this.getByCheckId(current.checkId);
                const application = this.bot.db.get(check.get('application'));
                await this.processCheck({ application, check, onfidoCheck: update });
            };
            for (const batch of batches) {
                await Promise.all(batch.map(processOne));
            }
        };
        this._list = async (opts) => {
            const { items } = await this.bot.db.find(opts);
            return items;
        };
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