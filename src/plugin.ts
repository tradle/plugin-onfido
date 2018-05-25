import _ = require('lodash')
import buildResource = require('@tradle/build-resource')
import { TYPE, SIG } from '@tradle/constants'
import baseModels from './models'
import onfidoModels from './onfido-models'
import Applicants from './applicants'
import Checks from './checks'
import {
  ILogger,
  IOnfidoComponent,
  PluginOpts,
  IncomingFormReq,
  OnfidoState,
  ProductOptions,
  OnfidoResult,
  Check,
  Resource
} from './types'

import APIUtils from './api-utils'
import {
  IPROOV_SELFIE,
  SELFIE,
  PHOTO_ID,
  APPLICANT,
  DEFAULT_WEBHOOK_KEY,
  ONFIDO_WEBHOOK_EVENTS,
  DEFAULT_WEBHOOK_EVENTS,
  APPLICATION,
  REPORTS,
  DEFAULT_REPORTS
} from './constants'

import Errors from './errors'
import ONFIDO_ERR_MESSAGES from './onfido-error-messages'
import ONFIDO_MAPPING from './onfido-tradle-mapping'

import * as utils from './utils'

const {
  getSelfie,
  getPhotoID,
  firstProp,
  parseReportURL,
  parseCheckURL,
  getOnfidoCheckIdKey,
  parseStub,
  getLatestFormByType,
  isApplicantInfoForm,
  addLinks,
  validateProductOptions,
  getFormStubs,
  getEnumValueId,
} = utils

// const REQUEST_EDITS_FOR = {
//   [APPLICANT]: true,
//   [SELFIE]: true
// }

const RETAKE_SELFIE_MESSAGE = 'Please retake your selfie, centering your face'

export default class Onfido implements IOnfidoComponent {
  public applicants:Applicants
  public checks:Checks
  public bot:any
  public products:ProductOptions[]
  public padApplicantName:boolean
  public formsToRequestCorrectionsFor:string[]
  public preCheckAddress:boolean
  public webhookKey:string
  public logger:ILogger
  public onfidoAPI: any
  public applications: any
  public apiUtils: APIUtils
  public conf: any
  public get models() {
    return this.bot.models
  }

  constructor (opts: PluginOpts) {
    const {
      logger,
      onfidoAPI,
      bot,
      products,
      applications,
      padApplicantName,
      formsToRequestCorrectionsFor=[],
      preCheckAddress,
      webhookKey=DEFAULT_WEBHOOK_KEY
      // onFinished
    } = opts

    this.logger = logger
    this.onfidoAPI = onfidoAPI
    this.applications = applications

    products.forEach(validateProductOptions)
    this.products = products.map(opts => {
      return {
        ...opts,
        reports: opts.reports || DEFAULT_REPORTS
      }
    })

    this.bot = bot
    this.conf = this.bot.conf.sub('onfido')
    this.padApplicantName = padApplicantName
    this.formsToRequestCorrectionsFor = formsToRequestCorrectionsFor
    this.preCheckAddress = preCheckAddress
    this.webhookKey = webhookKey
    // this.onFinished = onFinished
    this.apiUtils = new APIUtils(this)
    this.applicants = new Applicants(this)
    this.checks = new Checks(this)
  }

  public ['onmessage:tradle.Form'] = async (req):Promise<any|void> => {
    const { payload, application } = req
    if (!application) return

    const { applicant, requestFor } = application
    if (!this.getProductOptions(requestFor)) {
      this.logger.debug(`ignoring product ${requestFor}`)
      return
    }

    const form = _.cloneDeep(payload)
    const resolveEmbeds = this.bot.resolveEmbeds(form)
    const checks = await this.checks.listWithApplication(application._permalink)
    const pending = checks.find(utils.isPendingCheck)
    // nothing can be done until a check completes
    if (pending) {
      this.logger.debug(`check is already pending, ignoring ${form[TYPE]}`)
      return
    }

    let props
    const nonPending = checks.find(utils.isVirginCheck)
    if (nonPending) {
      props = nonPending
    } else {
      props = {
        application: buildResource.stub({
          models: this.models,
          model: this.models[APPLICATION],
          resource: application
        }),
        applicant
      }

      if (checks.length) {
        const latest = _.maxBy(checks, '_time')
        _.extend(props, _.pick(latest, ['onfidoApplicant']))
        ;['selfie', 'photoID'].forEach(prop => {
          const stub = latest[prop]
          if (!stub) return

          const parsed = parseStub(stub)
          const match = application.forms.find(sub => parseStub(sub.submission).link === parsed.link)
          if (match) {
            props[prop] = match.submission
          }
        })
      }
    }

    const check = this.bot.draft({
      type: onfidoModels.check.id,
      resource: props
    })

    await resolveEmbeds
    await this.handleForm({ req, application, check, form })
    if (check.isModified()) {
      await check.signAndSave()
    }
  }

  private ensureProductSupported = ({ application }: {
    application:any
  }):void => {
    const { requestFor } = application
    if (!this.getProductOptions(requestFor)) {
      throw new Error(`missing options for product "${requestFor}"`)
    }
  }

  public getProductOptions = (productModelId:string):ProductOptions => {
    return this.products.find(({ product }) => product === productModelId)
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
      this.logger.error('unrecognized onfido error', _.pick(error, ['message', 'stack', 'name']))

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

      propInfo = ONFIDO_ERR_MESSAGES[onfidoProp]
      if (propInfo) break
    }

    if (!propInfo) throw error

    const { user, application } = req
    const form = getFormStubs(application)
      .reverse()
      .find(({ type }) => {
        const mapping = ONFIDO_MAPPING[type]
        return mapping && mapping[onfidoProp]
      })

    if (!form) return

    const formType = form.type
    if (!this.formsToRequestCorrectionsFor.includes(formType)) {
      this.logger.info(`not configured to request edits for ${formType}`)
      // call this application "submitted"
      return true
    }

    const tradleProp = ONFIDO_MAPPING[formType][onfidoProp].tradle
    const message = propInfo.error || Errors.INVALID_VALUE
    if (formType === SELFIE) {
      await this.applications.requestItem({
        req,
        user,
        application,
        item: SELFIE,
        message: RETAKE_SELFIE_MESSAGE
      })

      return
    }

    const prefill = _.omit(await this.apiUtils.getResource(form, req), SIG)
    this.logger.debug(`requesting edit of ${formType}`)
    await this.applications.requestEdit({
      req,
      item: prefill,
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

  public createOnfidoCheck = async ({ req, application, check, reports }: {
    req?: any
    reports?: string[]
    application: any
    check: Resource
  }) => {
    this.ensureProductSupported({ application })

    if (!reports) {
      ({ reports } = this.getProductOptions(application.requestFor))
    }

    return await this.checks.create({ req, application, check, reports })
  }

  public unregisterWebhook = async ({ url }) => {
    await this.onfidoAPI.webhooks.unregister(url)
    await this.conf.del(this.webhookKey)
  }

  public registerWebhook = async ({ url, events=DEFAULT_WEBHOOK_EVENTS }: {
    url:string,
    events?:string[]
  }) => {
    events.forEach(event => {
      if (!ONFIDO_WEBHOOK_EVENTS.includes(event)) {
        throw new Error(`invalid webhook event: ${event}`)
      }
    })

    const webhook = await this.onfidoAPI.webhooks.register({ url, events })
    await this.conf.put(this.webhookKey, webhook)
    return webhook
  }

  public getWebhook = async () => {
    return await this.conf.get(this.webhookKey)
  }

  public processWebhookEvent = async (opts) => {
    try {
      await this._processWebhookEvent(opts)
    } catch (err) {
      throw httpError(err.status || 500, 'failed to process webhook event')
    }
  }

  public _processWebhookEvent = async ({ req, body, desiredResult }: {
    req:any,
    body?:any,
    desiredResult?: OnfidoResult
  }) => {
    let webhook
    try {
      webhook = await this.getWebhook()
    } catch (err) {
      this.logger.error('webhook not registered, ignoring event', err)
      throw httpError(400, 'webhook not registered')
    }

    let event
    try {
      event = await this.onfidoAPI.webhooks.handleEvent(req, webhook.token, body)
    } catch (err) {
      this.logger.error('failed to process webhook event', err)
      const status = /invalid hmac/i.test(err.message)
        ? 400
        : 500

      throw httpError(status, err.message)
    }

    const { resource_type, action, object } = event
    if (this.apiUtils.isTestMode() && desiredResult) {
      object.result = desiredResult
    }

    if (!/\.completed?$/.test(action)) return

    let checkId
    let applicantId
    if (resource_type === 'report') {
      checkId = parseReportURL(object).checkId
    } else if (resource_type === 'check') {
      checkId = object.id
      // applicantId = parseCheckURL(object).applicantId
    } else {
      const msg = 'unknown resource_type: ' + resource_type
      this.logger.warn(msg)
      throw httpError(400, msg)
    }

    let check
    try {
      check = await this.checks.getByCheckId(checkId)
    } catch (err) {
      const msg = `check not found`
      this.logger.warn(`${msg}: ${err.message}`)
      throw httpError(400, msg)
    }

    applicantId = check.get('onfidoApplicant').id
    const getUpdatedCheck = this.checks.fetchFromOnfido({ applicantId, checkId })

    const getApplication = this.bot.db.get(check.get('application'))
    const [onfidoCheck, application] = await Promise.all([
      getUpdatedCheck,
      getApplication
    ])

    await this.checks.processCheck({ application, check, onfidoCheck })
  }

  private handleForm = async (opts: IncomingFormReq) => {
    try {
      await this._handleForm(opts)
    } catch (error) {
      await this.handleOnfidoError({ req: opts.req, error })
      return
    }
  }

  private _handleForm = async ({ req, application, check, form }: IncomingFormReq) => {
    const type = form[TYPE]
    const onfidoStatus = check.get('onfidoStatus')
    if (onfidoStatus) {
      const onfidoResult = check.get('onfidoResult')
      if (onfidoResult) {
        this.logger.info(`received ${type} but already have a check complete. Ignoring for now.`)
      } else {
        this.logger.info(`received ${type} but already have a check pending. Ignoring for now.`)
      }

      return
    }

    const onfidoApplicant = check.get('onfidoApplicant')
    if (onfidoApplicant) {
      const ok = await this.updateApplicant({ req, application, check, form })
      if (!ok) return
    } else {
      const ok = await this.applicants.createOrUpdate({ req, application, check, form })
      if (!ok) return
    }

    const ok = await this.uploadAttachments({ req, application, check, form })
    if (!ok) return

    if (this.hasRequiredAttachments({ application, check })) {
      await this.createOnfidoCheck({ req, application, check })
    }
  }

  // private execWithErrorHandler = async (fn, opts):Promise<boolean> => {
  //   const { req } = opts
  //   try {
  //     await fn(opts)
  //     return true
  //   } catch (error) {
  //     await this.handleOnfidoError({ req, error })
  //     return false
  //   }
  // }

  public updateApplicant = async ({ req, application, check, form }: OnfidoState):Promise<boolean> => {
    try {
      await this.applicants.update({ req, application, check, form })
      return true
    } catch (error) {
      await this.handleOnfidoError({ req, error })
      return false
    }
  }

  public uploadAttachments = async ({ req, application, check, form }: OnfidoState):Promise<boolean> => {
    const props = this.getRequiredAttachments(application)
    if (props.includes('selfie') && !check.get('selfie')) {
      const selfie = await this.getForm({ type: SELFIE, application, form, req })
      if (selfie) {
        const ok = await this.applicants.uploadSelfie({ req, application, check, form: selfie })
        if (!ok) return false
      }
    }

    if (props.includes('photoID') && !check.get('photoID')) {
      const photoID = await this.getForm({ type: PHOTO_ID, application, form, req })
      if (photoID) {
        const ok = await this.applicants.uploadPhotoID({ req, application, check, form: photoID })
        if (!ok) return false
      }
    }

    return true
  }

  public sync = async () => {
    await this.checks.sync()
  }

  private getForm = async ({ type, application, form, req }) => {
    if (type === form[TYPE]) return form

    const parsedStub = getLatestFormByType(application, type)
    if (parsedStub) {
      return await this.apiUtils.getResource(parsedStub, req)
    }
  }

  private getRequiredAttachments = (application) => {
    const required:any = {}
    const { reports } = this.getProductOptions(application.requestFor)
    if (reports.includes('facialsimilarity')) {
      required.selfie = true
    }

    if (reports.includes('document') || reports.includes('identity')) {
      required.photoID = true
    }

    return Object.keys(required)
  }

  private hasRequiredAttachments = ({ application, check }: {
    application: any
    check: Resource
  }) => {
    const required = this.getRequiredAttachments(application)
    return required.every(prop => check.get(prop))
  }
}

export { Onfido }
const getStateKey = application => {
  return `${APPLICATION}_${application._permalink}_onfidoState`
}

const httpError = (status, message) => {
  debugger
  const err:any = new Error(message)
  err.status = status
  return err
}
