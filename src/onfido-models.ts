const onfidoModels = require('@tradle/models-onfido')
const opResult = onfidoModels['tradle.onfido.OpResult']
const checkStatus = onfidoModels['tradle.onfido.CheckStatus']
const reportStatus = onfidoModels['tradle.onfido.ReportStatus']
const reportType = onfidoModels['tradle.onfido.ReportType']
const check = onfidoModels['tradle.onfido.Check']
const state = onfidoModels['tradle.onfido.ApplicationState']
const stateStub = onfidoModels['tradle.onfido.ApplicationStateStub']

export default {
  opResult,
  checkStatus,
  reportStatus,
  reportType,
  check,
  state,
  stateStub
}
