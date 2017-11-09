import { TYPE } from '@tradle/constants'
import mergeModels = require('@tradle/merge-models')
import onfidoModels from './onfido-models'
import Applicants from './applicants'
import Checks from './checks'
import {
  Logger,
  IOnfidoComponent,
  PluginOpts,
  IncomingFormReq
} from './types'

import APIUtils from './api-utils'
import {
  IPROOV_SELFIE,
  SELFIE,
  PHOTO_ID,
  APPLICANT
} from './constants'

import Errors from './errors'
import ONFIDO_PROP_INFO from './onfido-props'

import {
  getSelfie,
  getPhotoID,
  firstProp,
  parseReportURL,
  getOnfidoCheckIdKey,
  parseStub,
  getLatestFormByType,
  isApplicantInfoForm,
  ensureNoPendingCheck
} from './utils'

// const REQUEST_EDITS_FOR = {
//   [APPLICANT]: true,
//   [SELFIE]: true
// }

const ONFIDO_WEBHOOK_KEY = 'onfido_webhook'

export class Onfido implements IOnfidoComponent {
  public applicants:Applicants
  public checks:Checks
  public bot:any
  public products:string[]
  public padApplicantName:boolean
  public formsToRequestCorrectionsFor:string[]
  public logger:Logger
  public onfidoAPI: any
  public productsAPI:any
  public apiUtils: APIUtils
  public models: any
  constructor (opts: PluginOpts) {
    const {
      logger,
      onfidoAPI,
      products,
      productsAPI,
      padApplicantName,
      formsToRequestCorrectionsFor,
      // onFinished
    } = opts

    this.logger = logger
    this.onfidoAPI = onfidoAPI
    this.products = products
    this.productsAPI = productsAPI
    this.bot = productsAPI.bot
    this.models = mergeModels()
      .add(productsAPI.models.all)
      .add(onfidoModels.all)
      .get()

    this.padApplicantName = padApplicantName
    this.formsToRequestCorrectionsFor = formsToRequestCorrectionsFor
    // this.onFinished = onFinished
    this.apiUtils = new APIUtils(opts)
    this.applicants = new Applicants(this)
    this.checks = new Checks(this)
  }

  public ['onmessage:tradle.Form'] = (req):void|Promise<any> => {
    const { payload, type, application } = req
    if (!application) return

    const { state, requestFor } = application
    if (!this.products.includes(requestFor)) {
      this.logger.debug(`ignoring product ${requestFor}`)
      return
    }

    const { pendingCheck, status } = state
    // nothing can be done until a check completes
    if (pendingCheck) {
      this.logger.debug(`check is already pending, ignoring ${type}`)
      return
    }

    return this.handleForm({ req, application, state, form: payload })
  }

  public handleOnfidoError = async ({ req, error }) => {
    if (error instanceof TypeError || error instanceof SyntaxError || error instanceof ReferenceError) {
      // developer error
      this.logger.error('developer error', error)
      throw error
    }

    const { body={}, status=-1 } = error
    const { type, fields } = body
    if (!(status === 422 || type === 'validation_error')) {
      this.logger.error('unrecognized onfido error', JSON.stringify(error, null, 2))
      // call this application "submitted"
      // this.onFinished()
      return true
    }

    this.logger.error('onfido threw validation error:', body)

    let onfidoProp
    let propInfo
    for (onfidoProp in fields) {
      if (onfidoProp === 'addresses') {
        // e.g. "addresses": [{ "postcode": "Invalid postcode" }]
        onfidoProp = firstProp(fields[onfidoProp][0])
      }

      propInfo = ONFIDO_PROP_INFO[onfidoProp]
      if (propInfo) break
    }

    if (!propInfo) throw error

    const tradleProp = propInfo.tradle
    const formType = propInfo.form
    if (!this.formsToRequestCorrectionsFor.includes(formType)) {
      this.logger.info(`not configured to request edits for ${formType}`)
      // call this application "submitted"
      return true
    }

    const application = req.application || req.product
    const form = getLatestFormByType(application, formType)
    if (!form) {
      this.logger.error(`failed to find form for property: ${onfidoProp}`)
      throw error
    }

    const message = propInfo.error || Errors.INVALID_VALUE
    const prefill = formType === SELFIE
      ? { [TYPE]: formType }
      : form

    this.logger.debug(`requesting edit of ${formType}`)
    await this.productsAPI.requestEdit({
      req,
      object: prefill,
      details: {
        errors: [
          {
            name: tradleProp,
            error: message
          }
        ]
      }
    })

    return false
  }

  public processWebhookEvent = async ({ req, res, desiredResult }) => {
    const url = 'https://' + req.get('host') + req.originalUrl
    let webhook
    try {
      webhook = await this.bot.conf.get(ONFIDO_WEBHOOK_KEY)
    } catch (err) {
      throw new Error('webhook not found for url: ' + url)
    }

    let event
    try {
      event = await this.onfidoAPI.webhooks.handleEvent(req, webhook.token)
    } catch (err) {
      this.logger.error('failed to process webhook event', err)
      return res.status(500).end()
    }

    const { resource_type, action, object } = event
    if (this.apiUtils.isTestMode() && desiredResult) {
      object.result = desiredResult
    }

    if (!/\.completed?$/.test(action)) {
      return res.status(200).end()
    }

    let checkId
    if (resource_type === 'report') {
      checkId = parseReportURL(object.href).checkId
    } else if (resource_type === 'check') {
      checkId = object.id
    } else {
      this.logger.warn('unknown resource_type: ' + resource_type)
      return res.status(404).end()
    }

    // const checkInfo = await this.bot.conf.get(getOnfidoCheckIdKey(checkId))

    // try {
    //   const complete = yield completeChecks.getAsync(checkId)
    //   return res.status(200).end()
    // } catch (err) {
    // }

    // let current
    // try {
    //   current = yield getPendingCheckById(checkId)
    // } catch (err) {
    //   debug(err)
    //   return res.status(err.notFound ? 404 : 500).end()
    // }

    // let update
    // let applicant
    // try {
    //   const result = yield updatePendingCheck({ check: clone(current) })
    //   update = result.check
    //   applicant = result.applicant
    // } catch (err) {
    //   debug(err)
    //   return res.status(500).end()
    // }

    // emitCompletedReports({ applicant, current, update })
    // res.status(200).end()
  }

  private handleForm = async ({ req, application, state, form }: IncomingFormReq) => {
    const { type } = req
    const { result, pendingCheck, onfidoApplicant, selfie, photoID } = state
    if (!onfidoApplicant) {
      try {
        await this.applicants.createOrUpdate({ req, application, state, form })
      } catch (error) {
        await this.handleOnfidoError({ req, error })
      }

      return
    }

    if (!pendingCheck) {
      await this.updateApplicantAndCreateCheck({ req, application, state, form })
      return
    }

    if (!result) {
      this.logger.info(`received ${type} but already have a check pending. Ignoring for now.`)
      return
    }

    if (result) {
      this.logger.info(`received ${type} but already have a check complete. Ignoring for now.`)
      return
    }
  }

  private updateApplicantAndCreateCheck = async ({ req, application, state, form }: IncomingFormReq) => {
    try {
      await this.applicants.update({ req, application, state, form })
    } catch (error) {
      await this.handleOnfidoError({ req, error })
      return
    }

    if (!state.selfie) {
      const selfie = type === SELFIE ? form : getSelfie(application)
      if (selfie) {
        const ok = await this.applicants.uploadSelfie({ req, application, state, form: selfie })
        if (!ok) return
      }
    }

    if (!state.photoID) {
      const photoID = type === PHOTO_ID ? form : getPhotoID(application)
      if (photoID) {
        const ok = await this.applicants.uploadPhotoID({ req, application, state, form: photoID })
        if (!ok) return
      }
    }

    try {
      await this.createCheck({ state })
    } finally {
      await this.bot.save(state)
    }
  }

  private createCheck = async ({ state }) => {
    return await this.checks.create({
      state,
      reports: onfidoModels.reportType.enum.map(({ id }) => id)
    })
  }
}

export default opts => new Onfido(opts)
