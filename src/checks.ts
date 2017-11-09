import buildResource = require('@tradle/build-resource')
import { Onfido } from './'
import APIUtils from './api-utils'
import onfidoModels from './onfido-models'
import { IOnfidoComponent, ILogger } from './types'
import {
  ensureNoPendingCheck,
  parseStub
} from './utils'

const { reportType } = onfidoModels
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
}

export default class Checks implements IOnfidoComponent {
  public productsAPI: any
  public onfidoAPI: any
  public logger: ILogger
  public apiUtils: APIUtils
  public models: any
  constructor (main:Onfido) {
    this.productsAPI = main.productsAPI
    this.onfidoAPI = main.onfidoAPI
    this.logger = main.logger
    this.apiUtils = main.apiUtils
    this.models = main.models
  }

  public create = async ({ state, reports }: {
    state: any
    reports: string[]
  }) => {
    ensureNoPendingCheck(state)
    if (!state.onfidoApplicant) {
      throw new Error('expected "onfidoApplicant" to have been created already')
    }

    if (!reports.length) {
      throw new Error('expected check to have at least one report')
    }

    reports.forEach(report => {
      if (!reportType.enum.find(({ id }) => id === report)) {
        throw new Error(`invalid report type: ${report}, expected one of: ${reportType.enum.join(', ')}`)
      }
    })

    const result = await this.onfidoAPI.create(state.id, {
      reports: reports.map(name => REPORT_TYPE_TO_ONFIDO_NAME[name])
    })

    const check = buildResource({
        models: this.models,
        model: onfidoModels.check
      })
      .set({
        status: 'checkpending',
        reports,
        results: []
      })
      .toJSON()

    state.pendingCheck = check
    await this.processCheck({ state, check, update: result })
    return check
  }

  public processCheck = async ({ state, check, update }) => {
    const { result, status } = update
    if (status.startsWith('complete')) {
      check.status = 'complete'
      delete state.pendingCheck
      this.logger.info(`check for ${parseStub(state.applicant).permalink} completed with result: ${result}`)

      // ee.emit('check', ret)
      // // allow subscribing to 'check:consider', 'check:complete'
      // ee.emit('check:' + result, ret)
    } else {
      check.status = status
    }

    // emitCompletedReports({ applicant, current, update })
  }
}
