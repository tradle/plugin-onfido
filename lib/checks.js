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
const onfido_models_1 = require("./onfido-models");
const utils_1 = require("./utils");
const { reportType } = onfido_models_1.default;
const REPORT_TYPE_TO_ONFIDO_NAME = {
    document: {
        name: 'document'
    },
    face: {
        name: 'facial_similarity'
    },
    identity: {
        name: 'identity',
        variant: 'kyc'
    }
};
class Checks {
    constructor(main) {
        this.create = ({ state, reports }) => __awaiter(this, void 0, void 0, function* () {
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
            const result = yield this.onfidoAPI.create(state.id, {
                reports: reports.map(name => REPORT_TYPE_TO_ONFIDO_NAME[name])
            });
            const check = buildResource({
                models: this.models,
                model: onfido_models_1.default.check
            })
                .set({
                status: 'checkpending',
                reports,
                results: []
            })
                .toJSON();
            state.pendingCheck = check;
            yield this.processCheck({ state, check, update: result });
            return check;
        });
        this.processCheck = ({ state, check, update }) => __awaiter(this, void 0, void 0, function* () {
            const { result, status } = update;
            if (status.startsWith('complete')) {
                check.status = 'complete';
                delete state.pendingCheck;
                this.logger.info(`check for ${utils_1.parseStub(state.applicant).permalink} completed with result: ${result}`);
                // ee.emit('check', ret)
                // // allow subscribing to 'check:consider', 'check:complete'
                // ee.emit('check:' + result, ret)
            }
            else {
                check.status = status;
            }
            // emitCompletedReports({ applicant, current, update })
        });
        this.productsAPI = main.productsAPI;
        this.onfidoAPI = main.onfidoAPI;
        this.logger = main.logger;
        this.apiUtils = main.apiUtils;
        this.models = main.models;
    }
}
exports.default = Checks;
//# sourceMappingURL=checks.js.map