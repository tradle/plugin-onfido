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
const utils_1 = require("./utils");
const enum_value_map_1 = require("./enum-value-map");
const constants_2 = require("./constants");
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
        this.create = ({ req, application, state, reports, saveState }) => __awaiter(this, void 0, void 0, function* () {
            utils_1.ensureNoPendingCheck(state);
            if (!state.onfidoApplicant) {
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
            let check = yield this.onfidoAPI.checks.create(state.onfidoApplicant.id, {
                reports: reports.map(name => REPORT_TYPE_TO_ONFIDO_NAME[name])
            });
            check = utils_1.sanitize(check).sanitized;
            const current = buildResource({
                models: models_1.default,
                model: onfido_models_1.default.check
            })
                .set({
                status: 'inprogress',
                reportsOrdered: reports.map(id => ({ id })),
                rawData: check,
                checkId: check.id,
                applicantId: state.onfidoApplicant.id
            })
                .toJSON();
            const updated = yield this.processCheck({
                req,
                application,
                state,
                current,
                update: check,
                saveState
            });
            yield this.saveCheckMapping({
                check: updated,
                state
            });
            return check;
        });
        this.processReport = ({ req, application, state, check, report }) => __awaiter(this, void 0, void 0, function* () {
            if (!(application && state && check)) {
                throw new Error('expected "application", "state", and "check"');
            }
            // ({ application, state, check } = await this.loadStateAppAndCheck({
            //   application,
            //   state,
            //   check,
            //   report
            // }))
            const idx = check.rawData.reports.findIndex(r => r.id === report.id);
            check.rawData.reports[idx] = report;
            // const { reportsResults=[] } = check
            // const idx = reportsResults.findIndex(r => r.id === report.id)
            // if (idx === -1) {
            //   reportsResults.push(report)
            // } else {
            //   reportsResults[idx] = report
            // }
            // check.reportsResults = reportsResults
            if (report.status === 'complete') {
                yield this.processCompletedReport({ req, application, state, report });
            }
        });
        this.processCheck = ({ req, application, state, current, update, saveState }) => __awaiter(this, void 0, void 0, function* () {
            if (!(application && state && current)) {
                throw new Error('expected "application", "state", and "current"');
            }
            const { applicant } = state;
            const { status, result } = update;
            const newCheckProps = {
                status: enum_value_map_1.fromOnfido[status] || status
            };
            if (result) {
                newCheckProps.result = result;
                this.apiUtils.setProps(state, { result });
            }
            this.apiUtils.setProps(current, newCheckProps);
            if (utils_1.isComplete(update)) {
                this.logger.info(`check for ${applicant.id} completed with result: ${result}`);
            }
            else {
                this.logger.debug(`check for ${applicant.id} status: ${status}`);
            }
            const reports = utils_1.getCompletedReports({
                current: current[constants_1.SIG] ? current.rawData : null,
                update
            });
            if (reports.length) {
                let willAutoSave = !!req;
                const appCopy = _.cloneDeep(application);
                yield Promise.all(reports.map(report => {
                    return this.processReport({ req, application, state, check: current, report });
                }));
                if (!willAutoSave && !_.isEqual(application, appCopy)) {
                    yield this.productsAPI.saveNewVersionOfApplication({ application });
                }
            }
            current.rawData = utils_1.sanitize(current.rawData).sanitized;
            let updated;
            if (current[constants_1.SIG]) {
                updated = yield this.bot.versionAndSave(current);
            }
            else {
                updated = yield this.bot.signAndSave(current);
            }
            this.apiUtils.setProps(state, {
                check: updated,
                checkStatus: updated.status
            });
            if (saveState) {
                yield this.bot.versionAndSave(state);
            }
            // emitCompletedReports({ applicant, current: updated, update })
            return updated;
        });
        this.processCompletedReport = ({ req, application, state, report }) => __awaiter(this, void 0, void 0, function* () {
            const { applicant, applicantDetails, selfie, photoID } = state;
            const type = report.name;
            this.logger.debug(`report ${type} complete for applicant ${applicant.id}`);
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
            report = utils_1.sanitize(report).sanitized;
            if (report.result !== 'clear')
                return;
            const applicantPermalink = utils_1.parseStub(applicant).permalink;
            const userPromise = this.apiUtils.getUser(applicantPermalink, req);
            yield Promise.all(stubs.map((stub) => __awaiter(this, void 0, void 0, function* () {
                const verification = utils_1.createOnfidoVerification({
                    applicant,
                    report,
                    form: yield this.apiUtils.getResource(stub, req)
                });
                const signed = yield this.bot.sign(verification);
                utils_1.addLinks(signed);
                this.productsAPI.importVerification({
                    user: yield userPromise,
                    application,
                    verification: signed
                });
                yield this.bot.save(signed);
            })));
        });
        this.lookupByCheckId = (checkId) => __awaiter(this, void 0, void 0, function* () {
            const { application, state, check } = yield this.getCheckMapping(checkId);
            return {
                application: yield this.apiUtils.getResource({
                    type: constants_2.APPLICATION,
                    permalink: application
                }),
                state: yield this.apiUtils.getResource({
                    type: onfido_models_1.default.state.id,
                    permalink: state
                }),
                check: yield this.apiUtils.getResource({
                    type: onfido_models_1.default.check.id,
                    permalink: check
                })
            };
        });
        // public lookupByCheckId = async (opts: {
        //   application: any,
        //   state: any,
        //   checkId?: string,
        //   check?: any
        // }) => {
        //   if (opts.application && opts.state && opts.check) {
        //     return opts
        //   }
        //   const mapping = opts.state
        //     ? {
        //       application: parseStub(opts.state.application).permalink,
        //       state: opts.state._permalink,
        //       check: opts.state.check && parseStub(opts.state.check).permalink
        //     }
        //     : await this.getCheckMapping(opts.checkId)
        //   const getApplication = opts.application
        //     ? Promise.resolve(opts.application)
        //     : this.apiUtils.getResource({
        //         type: APPLICATION,
        //         permalink: mapping.application
        //       })
        //   const getState = opts.state
        //     ? Promise.resolve(opts.state)
        //     : this.apiUtils.getResource({
        //         type: onfidoModels.state.id,
        //         permalink: mapping.state
        //       })
        //   const getCheck = opts.check
        //     ? Promise.resolve(opts.check)
        //     : mapping.check && this.apiUtils.getResource({
        //         type: onfidoModels.check.id,
        //         permalink: mapping.check
        //       })
        //   return {
        //     application: await getApplication,
        //     state: await getState,
        //     check: await getCheck
        //   }
        // }
        // public loadStateAppAndCheck = async ({ application, state, check, report }) => {
        //   const checkId = check ? check.checkId : parseReportURL(report.href).checkId
        //   return await this.lookupByCheckId({
        //     application,
        //     state,
        //     check,
        //     checkId
        //   })
        // }
        this.saveCheckMapping = ({ state, check }) => __awaiter(this, void 0, void 0, function* () {
            yield this.bot.kv.put(getCheckKey(check.rawData.id), {
                application: utils_1.parseStub(state.application).permalink,
                state: buildResource.permalink(state),
                check: buildResource.permalink(check)
            });
        });
        this.getCheckMapping = (checkId) => __awaiter(this, void 0, void 0, function* () {
            return yield this.bot.kv.get(getCheckKey(checkId));
        });
        this.fetch = ({ applicantId, checkId }) => __awaiter(this, void 0, void 0, function* () {
            this.logger.debug(`looking up check ${checkId} for applicant ${applicantId}`);
            return yield this.onfidoAPI.checks.get({
                applicantId,
                checkId,
                expandReports: true
            });
        });
        this.list = () => __awaiter(this, void 0, void 0, function* () {
            return yield this.bot.db.find({
                filter: {
                    EQ: {
                        [constants_1.TYPE]: onfido_models_1.default.check.id
                    }
                }
            });
        });
        this.listWithStatus = (status) => __awaiter(this, void 0, void 0, function* () {
            return yield this.bot.db.find({
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
            const batches = utils_1.batchify(pending, CHECK_SYNC_BATCH_SIZE);
            const processOne = (current) => __awaiter(this, void 0, void 0, function* () {
                const update = yield this.fetch(current);
                const status = enum_value_map_1.fromOnfido[update.status] || update.status;
                if (status === current.status)
                    return;
                const { application, state, check } = yield this.lookupByCheckId(current.checkId);
                yield this.processCheck({ application, state, current, update, saveState: true });
            });
            for (const batch of batches) {
                yield Promise.all(batch.map(processOne));
            }
        });
        this.productsAPI = main.productsAPI;
        this.bot = main.bot;
        this.onfidoAPI = main.onfidoAPI;
        this.logger = main.logger;
        this.apiUtils = main.apiUtils;
    }
}
exports.default = Checks;
const getCheckKey = checkId => `onfido_check_${checkId}`;
//# sourceMappingURL=checks.js.map