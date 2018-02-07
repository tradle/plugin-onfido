"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const onfidoModels = require('@tradle/models-onfido');
const opResult = onfidoModels['tradle.onfido.OpResult'];
const checkStatus = onfidoModels['tradle.onfido.CheckStatus'];
const reportStatus = onfidoModels['tradle.onfido.ReportStatus'];
const reportType = onfidoModels['tradle.onfido.ReportType'];
const check = onfidoModels['tradle.onfido.Check'];
const state = onfidoModels['tradle.onfido.ApplicationState'];
const stateStub = onfidoModels['tradle.onfido.ApplicationStateStub'];
const models = {
    opResult,
    checkStatus,
    reportStatus,
    reportType,
    check,
    state,
    stateStub,
    all: {}
};
for (let name in models) {
    models.all[name] = models[name];
}
exports.default = models;
//# sourceMappingURL=onfido-models.js.map