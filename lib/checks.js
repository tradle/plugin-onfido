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
const buildResource = require("@tradle/build-resource");
const constants_1 = require("@tradle/constants");
const onfido_models_1 = require("./onfido-models");
const utils_1 = require("./utils");
const enum_value_map_1 = require("./enum-value-map");
const constants_2 = require("./constants");
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
        this.create = ({ application, state, reports }) => __awaiter(this, void 0, void 0, function* () {
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
            const check = yield this.onfidoAPI.checks.create(state.onfidoApplicant.id, {
                reports: reports.map(name => REPORT_TYPE_TO_ONFIDO_NAME[name])
            });
            const current = buildResource({
                models: this.models,
                model: onfido_models_1.default.check
            })
                .set({
                status: 'inprogress',
                reportsOrdered: reports.map(id => ({ id })),
                reportsResults: [],
                rawData: check
            })
                .toJSON();
            yield this.processCheck({ application, state, current, update: check });
            yield this.saveCheckMapping({
                check: current,
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
                yield this.processCompletedReport({ req, application, state, check, report });
            }
        });
        this.processCheck = ({ req, application, state, current, update }) => __awaiter(this, void 0, void 0, function* () {
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
            // const reports = getCompletedReports({ current, update })
            const reports = update.reports;
            if (reports.length) {
                yield Promise.all(reports.map(report => {
                    return this.processReport({ req, application, state, check: current, report });
                }));
            }
            if (current[constants_1.SIG]) {
                yield this.productsAPI.version(current);
            }
            else {
                yield this.productsAPI.sign(current);
                utils_1.addLinks(current);
            }
            this.apiUtils.setProps(state, {
                check: current,
                checkStatus: current.status
            });
            yield this.productsAPI.save(current);
            // emitCompletedReports({ applicant, current, update })
        });
        this.processCompletedReport = ({ req, application, state, report }) => __awaiter(this, void 0, void 0, function* () {
            const { applicant, selfie, photoID } = state;
            const type = report.name;
            this.logger.debug(`report ${type} complete for applicant ${applicant.id}`);
            let stub;
            if (type === 'document') {
                stub = photoID;
            }
            else if (type === 'facial_similarity') {
                stub = selfie;
            }
            else if (type === 'identity') {
                stub = applicant;
            }
            else {
                this.logger.error('unknown report type: ' + type, report);
                return;
            }
            if (report.result === 'clear') {
                const verification = utils_1.createOnfidoVerification({
                    applicant,
                    report,
                    form: yield this.apiUtils.getResource(stub)
                });
                yield this.productsAPI.importVerification({
                    req,
                    application,
                    verification: yield this.productsAPI.sign(verification)
                });
            }
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
        this.saveCheckMapping = ({ state, check }) => {
            return this.bot.kv.put(getCheckKey(check.rawData.id), {
                application: utils_1.parseStub(state.application).permalink,
                state: buildResource.permalink(state),
                check: buildResource.permalink(check)
            });
        };
        this.getCheckMapping = (checkId) => {
            return this.bot.kv.get(getCheckKey(checkId));
        };
        this.fetch = ({ applicantId, checkId }) => {
            this.logger.debug(`looking up check ${checkId} for applicant ${applicantId}`);
            return this.onfidoAPI.checks.get({
                applicantId,
                checkId,
                expandReports: true
            });
        };
        this.productsAPI = main.productsAPI;
        this.bot = main.bot;
        this.onfidoAPI = main.onfidoAPI;
        this.logger = main.logger;
        this.apiUtils = main.apiUtils;
        this.models = main.models;
    }
}
exports.default = Checks;
const getCheckKey = checkId => `onfido_check_${checkId}`;
//# sourceMappingURL=checks.js.map