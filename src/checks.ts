import _ = require('lodash')
import buildResource = require('@tradle/build-resource')
import { TYPE, SIG } from '@tradle/constants'
import { Onfido } from './'
import APIUtils from './api-utils'
import models from './models'
import onfidoModels from './onfido-models'
import { IOnfidoComponent, ILogger, Check, Resource } from './types'
import {
  ensureNoPendingCheck,
  parseStub,
  getCompletedReports,
  isComplete,
  createOnfidoVerification,
  parseReportURL,
  addLinks,
  getStatus,
} from './utils'

import { toOnfido, fromOnfido } from './enum-value-map'

import {
  APPLICATION
} from './constants'

const CHECK_SYNC_BATCH_SIZE = 10
const { reportType } = onfidoModels
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
}

// const ONFIDO_STATUS_TO_STATUS {
//   in_progress: 'pending',
//   withdrawn: 'canceled',

// }

export default class Checks implements IOnfidoComponent {
  public applications: any
  public bot: any
  public onfidoAPI: any
  public logger: ILogger
  public apiUtils: APIUtils
  constructor (main:Onfido) {
    this.applications = main.applications
    this.bot = main.bot
    this.onfidoAPI = main.onfidoAPI
    this.logger = main.logger
    this.apiUtils = main.apiUtils
  }

  public create = async ({ req, application, check, reports }: {
    req?:any,
    application: any
    check: Resource
    reports: string[]
  }) => {
    ensureNoPendingCheck(check)
    if (!check.get('onfidoApplicant')) {
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

    this.logger.debug(`creating check`, {
      application: application._permalink
    })

    const onfidoCheck = await this.onfidoAPI.checks.create(check.get('onfidoApplicant').id, {
      reports: reports.map(name => REPORT_TYPE_TO_ONFIDO_NAME[name])
    })

    check.set({ dateChecked: Date.now() })
    await this.processCheck({
      req,
      application,
      check,
      onfidoCheck
    })
  }

  public processReport = async ({ req, application, check, report }: {
    req?:any,
    application: any
    check: Resource
    report: any
  }) => {
    if (!(application && check)) {
      throw new Error('expected "application" and "check"')
    }

    // ({ application, state, check } = await this.loadStateAppAndCheck({
    //   application,
    //   state,
    //   check,
    //   report
    // }))

    const rawData = _.cloneDeep(check.get('rawData'))
    const idx = rawData.reports.findIndex(r => r.id === report.id)
    rawData.reports[idx] = report
    check.set({ rawData })

    // const { reportsResults=[] } = check
    // const idx = reportsResults.findIndex(r => r.id === report.id)
    // if (idx === -1) {
    //   reportsResults.push(report)
    // } else {
    //   reportsResults[idx] = report
    // }

    // check.reportsResults = reportsResults
    if (report.status === 'complete') {
      await this.processCompletedReport({ req, application, check, report })
    }
  }

  public processCheck = async ({ req, application, check, onfidoCheck }: {
    req?:any
    application
    check: Resource,
    onfidoCheck: any
  }) => {

    onfidoCheck = this.apiUtils.sanitize(onfidoCheck)

    if (!(application && check && onfidoCheck)) {
      throw new Error('expected "application", "check" and "onfidoCheck')
    }

    const prevOnfidoCheck = check.get('rawData')
    const applicant = check.get('applicant')
    const { status, result, id } = onfidoCheck
    const newCheckProps:any = {
      onfidoCheckId: id,
      onfidoStatus: fromOnfido[status] || status,
      rawData: onfidoCheck,
    }

    if (result) {
      newCheckProps.onfidoResult = result
      newCheckProps.status = getStatus(result)
    }

    check.set(newCheckProps)
    this.logger.debug(`check status update: ${status}`, {
      application: application._permalink
    })

    const reports = getCompletedReports({
      current: prevOnfidoCheck,
      update: onfidoCheck
    })

    if (reports.length) {
      const appCopy = _.cloneDeep(application)
      await Promise.all(reports.map(report => {
        return this.processReport({ req, application, check, report })
      }))
    }

    if (check.isModified()) {
      await check.signAndSave()
    } else {
      this.logger.debug(`check hasn't changed, ignoring update`, {
        application: application._permalink
      })
    }
  }

  public processCompletedReport = async ({ req, application, check, report }) => {
    const { applicant, applicantDetails, selfie, photoID } = check.toJSON({ validate: false })
    const type = report.name

    this.logger.debug('report complete', {
      application: application._permalink,
      type,
      result: report.result
    })

    let stubs = []
    if (type === 'document') {
      stubs.push(photoID)
    } else if (type === 'facial_similarity') {
      stubs.push(selfie)
    } else if (type === 'identity') {
      stubs.push(...applicantDetails)
    } else {
      this.logger.error('unknown report type: ' + type, report)
      return
    }

    if (report.result !== 'clear') return

    await Promise.all(stubs.map(async (stub) => {
      this.logger.debug('creating verification for', {
        application: application._permalink,
        form: this.apiUtils.toStableStub(stub)
      })

      const verification = createOnfidoVerification({
        applicant,
        report,
        form: await this.apiUtils.getResource(stub, req)
      })

      return await this.applications.createVerification({
        req,
        application,
        verification
      })
    }))
  }

  public fetchFromOnfido = async ({ applicantId, checkId }: {
    applicantId:string
    checkId:string
  }) => {
    this.logger.debug(`looking up check`, { checkId, applicantId })
    return await this.onfidoAPI.checks.get({
      applicantId,
      checkId,
      expandReports: true
    })
  }

  public list = async ():Promise<Check[]> => {
    return await this._list({
      filter: {
        EQ: {
          [TYPE]: onfidoModels.check.id
        }
      }
    })
  }

  public getByCheckId = async (checkId):Promise<Resource> => {
    const check = await this.bot.db.findOne({
      filter: {
        EQ: {
          [TYPE]: onfidoModels.check.id,
          onfidoCheckId: checkId
        }
      }
    })

    return this.bot.draft({ resource: check })
  }

  public listWithApplication = async (permalink):Promise<Check[]> => {
    return await this._list({
      filter: {
        EQ: {
          [TYPE]: onfidoModels.check.id,
          'application._permalink': permalink
        }
      }
    })
  }

  public listWithStatus = async (status:string|string[]):Promise<Check[]> => {
    return await this._list({
      filter: {
        EQ: {
          [TYPE]: onfidoModels.check.id
        },
        IN: {
          status: [].concat(status).map(value => buildResource.enumValue({
            model: onfidoModels.checkStatus,
            value
          }))
        }
      }
    })
  }

  public listPending = () => this.listWithStatus(['inprogress', 'paused', 'reopened'])
  public listCompleted = () => this.listWithStatus(['complete'])
  public listWithdrawn = () => this.listWithStatus(['withdrawn'])

  public sync = async () => {
    const pending = await this.listPending()
    const batches = _.chunk(pending, CHECK_SYNC_BATCH_SIZE)
    const processOne = async (current) => {
      const update = await this.fetchFromOnfido(current)
      const status = fromOnfido[update.status] || update.status
      if (status === current.status) return

      const check = await this.getByCheckId(current.checkId)
      const application = this.bot.db.get(check.get('application'))
      await this.processCheck({ application, check, onfidoCheck: update })
    }

    for (const batch of batches) {
      await Promise.all(batch.map(processOne))
    }
  }

  private _list = async (opts) => {
    const { items } = await this.bot.db.find(opts)
    return items
  }
}

const getCheckKey = checkId => `onfido_check_${checkId}`
