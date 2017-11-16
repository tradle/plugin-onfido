import pick = require('object.pick')
import clone = require('clone')
import deepEqual = require('deep-equal')
import buildResource = require('@tradle/build-resource')
import { TYPE, SIG } from '@tradle/constants'
import { Onfido } from './'
import APIUtils from './api-utils'
import onfidoModels from './onfido-models'
import { IOnfidoComponent, ILogger, CheckMapping } from './types'
import {
  ensureNoPendingCheck,
  parseStub,
  getCompletedReports,
  isComplete,
  createOnfidoVerification,
  parseReportURL,
  addLinks,
  sanitize,
  batchify
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
  public productsAPI: any
  public bot: any
  public onfidoAPI: any
  public logger: ILogger
  public apiUtils: APIUtils
  public models: any
  constructor (main:Onfido) {
    this.productsAPI = main.productsAPI
    this.bot = main.bot
    this.onfidoAPI = main.onfidoAPI
    this.logger = main.logger
    this.apiUtils = main.apiUtils
    this.models = main.models
  }

  public create = async ({ req, application, state, reports }: {
    req,
    application: any
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

    let check = await this.onfidoAPI.checks.create(state.onfidoApplicant.id, {
      reports: reports.map(name => REPORT_TYPE_TO_ONFIDO_NAME[name])
    })

    check = sanitize(check).sanitized
    const current = buildResource({
        models: this.models,
        model: onfidoModels.check
      })
      .set({
        status: 'inprogress',
        reportsOrdered: reports.map(id => ({ id })),
        rawData: check,
        checkId: check.id,
        applicantId: state.onfidoApplicant.id
      })
      .toJSON()

    const updated = await this.processCheck({
      req,
      application,
      state,
      current,
      update: check
    })

    await this.saveCheckMapping({
      check: updated,
      state
    })

    return check
  }

  public processReport = async ({ req, application, state, check, report }) => {
    if (!(application && state && check)) {
      throw new Error('expected "application", "state", and "check"')
    }

    // ({ application, state, check } = await this.loadStateAppAndCheck({
    //   application,
    //   state,
    //   check,
    //   report
    // }))

    const idx = check.rawData.reports.findIndex(r => r.id === report.id)
    check.rawData.reports[idx] = report

    // const { reportsResults=[] } = check
    // const idx = reportsResults.findIndex(r => r.id === report.id)
    // if (idx === -1) {
    //   reportsResults.push(report)
    // } else {
    //   reportsResults[idx] = report
    // }

    // check.reportsResults = reportsResults
    if (report.status === 'complete') {
      await this.processCompletedReport({ req, application, state, check, report })
    }
  }

  public processCheck = async ({ req, application, state, current, update }: {
    req?:any,
    application,
    state,
    current,
    update
  }) => {
    if (!(application && state && current)) {
      throw new Error('expected "application", "state", and "current"')
    }

    const { applicant } = state
    const { status, result } = update
    const newCheckProps = {
      status: fromOnfido[status] || status
    }

    if (result) {
      newCheckProps.result = result
      this.apiUtils.setProps(state, { result })
    }

    this.apiUtils.setProps(current, newCheckProps)
    if (isComplete(update)) {
      this.logger.info(`check for ${applicant.id} completed with result: ${result}`)
    } else {
      this.logger.debug(`check for ${applicant.id} status: ${status}`)
    }

    const reports = getCompletedReports({
      current: current[SIG] ? current.rawData : null,
      update
    })

    if (reports.length) {
      let willAutoSave = !!req
      const appCopy = clone(application)
      await Promise.all(reports.map(report => {
        return this.processReport({ req, application, state, check: current, report })
      }))

      if (!willAutoSave && !deepEqual(application, appCopy)) {
        await this.productsAPI.saveNewVersionOfApplication({ application })
      }
    }

    current.rawData = sanitize(current.rawData).sanitized

    let updated
    if (current[SIG]) {
      updated = await this.bot.versionAndSave(current)
    } else {
      updated = await this.bot.signAndSave(current)
    }

    this.apiUtils.setProps(state, {
      check: updated,
      checkStatus: updated.status
    })

    // emitCompletedReports({ applicant, current: updated, update })
    return updated
  }

  public processCompletedReport = async ({ req, application, state, report }) => {
    const { applicant, applicantDetails, selfie, photoID } = state
    const type = report.name

    this.logger.debug(`report ${type} complete for applicant ${applicant.id}`)

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

    report = sanitize(report).sanitized
    if (report.result === 'clear') {
      await Promise.all(stubs.map(async (stub) => {
        const verification = createOnfidoVerification({
          applicant,
          report,
          form: await this.apiUtils.getResource(stub)
        })

        const signed = await this.bot.sign(verification)
        addLinks(signed)
        await Promise.all([
          this.bot.save(signed),
          this.productsAPI.importVerification({
            req,
            application,
            verification: signed
          })
        ])
      }))
    }
  }

  public lookupByCheckId = async (checkId:string) => {
    const { application, state, check } = await this.getCheckMapping(checkId)
    return {
      application: await this.apiUtils.getResource({
        type: APPLICATION,
        permalink: application
      }),
      state: await this.apiUtils.getResource({
        type: onfidoModels.state.id,
        permalink: state
      }),
      check: await this.apiUtils.getResource({
        type: onfidoModels.check.id,
        permalink: check
      })
    }
  }

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

  public saveCheckMapping = ({ state, check }) => {
    return this.bot.kv.put(getCheckKey(check.rawData.id), {
      application: parseStub(state.application).permalink,
      state: buildResource.permalink(state),
      check: buildResource.permalink(check)
    })
  }

  public getCheckMapping = (checkId:string):Promise<CheckMapping> => {
    return this.bot.kv.get(getCheckKey(checkId))
  }

  public fetch = ({ applicantId, checkId }: {
    applicantId:string
    checkId:string
  }) => {
    this.logger.debug(`looking up check ${checkId} for applicant ${applicantId}`)
    return this.onfidoAPI.checks.get({
      applicantId,
      checkId,
      expandReports: true
    })
  }

  public list = () => {
    return this.bot.db.find({
      filter: {
        EQ: {
          [TYPE]: onfidoModels.check.id
        }
      }
    })
  }

  public listWithStatus = async (status:string|string[]) => {
    return await this.bot.db.find({
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
    const batches = batchify(pending, CHECK_SYNC_BATCH_SIZE)
    for (const batch of batches) {
      await Promise.all(pending.map(async (current) => {
        const update = await this.fetch(current)
        const status = fromOnfido[update.status] || update.status
        if (status === current.status) return

        const { application, state, check } = await this.lookupByCheckId(current.checkId)
        await this.processCheck({ application, state, current, update })
      }))
    }
  }
}

const getCheckKey = checkId => `onfido_check_${checkId}`
