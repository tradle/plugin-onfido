import _ = require('lodash')
import buildResource = require('@tradle/build-resource')
import { TYPE, SIG } from '@tradle/constants'
import models from './models'
import onfidoModels from './onfido-models'
import Applicants from './applicants'
import Checks from './checks'
import {
  ILogger,
  IOnfidoComponent,
  PluginOpts,
  PluginMode,
  IncomingFormReq,
  OnfidoState,
  ProductOptions,
  OnfidoResult,
  Check,
  Resource,
  PropertyMap
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
  DEFAULT_REPORTS,
  PROPERTY_SETS,
  REPORT_TO_ASPECT,
} from './constants'

import Errors from './errors'
import ONFIDO_ERR_MESSAGES from './onfido-error-messages'
import ONFIDO_MAPPING from './onfido-tradle-mapping'
import * as utils from './utils'

const DEFAULT_PROPERTY_MAP = require('./default-property-map')

const {
  getSelfie,
  getPhotoID,
  firstProp,
  parseReportURL,
  parseCheckURL,
  getOnfidoCheckIdKey,
  parseStub,
  getLatestFormByType,
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
const ONFIDO_WEBHOOK_CONTEXT = {
  provider: 'onfido'
}

const PROVIDER_NAME = 'Onfido'

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
  public secrets: any
  public mode: PluginMode
  public get models() {
    return this.bot.models
  }

  constructor (opts: PluginOpts) {
    const {
      mode='after',
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

    this.mode = mode
    this.logger = logger
    this.onfidoAPI = onfidoAPI
    this.applications = applications

    products.forEach(validateProductOptions)
    this.products = products.map(opts => {
      return {
        ...opts,
        reports: opts.reports || DEFAULT_REPORTS,
        propertyMap: opts.propertyMap || DEFAULT_PROPERTY_MAP
      }
    })

    this.bot = bot
    this.secrets = this.bot.secrets
    this.padApplicantName = padApplicantName
    this.formsToRequestCorrectionsFor = formsToRequestCorrectionsFor
    this.preCheckAddress = preCheckAddress
    this.webhookKey = webhookKey
    // this.onFinished = onFinished
    this.apiUtils = new APIUtils(this)
    this.applicants = new Applicants(this)
    this.checks = new Checks(this)
  }

  public onFormsCollected = async ({ req }):Promise<void> => {
    if (this.mode !== 'after') return

    const { payload, application } = req
    if (!application) return

    const { applicant, requestFor } = application
    const productOpts = this.getProductOptions(requestFor)
    if (!productOpts) return

    const checks = await this.checks.listWithApplication(application._permalink)
    const pending = checks.find(utils.isPendingCheck)

    // nothing can be done until a check completes
    if (pending) {
      this.logger.debug(`check is already pending, exiting`)
      return
    }

    // let relevant = application.forms
    //   .map(appSub => appSub.submission)
    //   .map(parseStub)
    //   .filter(({ type }) => !this.shouldIgnoreForm({ product: requestFor, form: type }))

    // relevant = _.uniqBy(relevant, ({ permalink }) => permalink)

    // const forms = await Promise.all(relevant.map(form => this.bot.getResource(form)))
    this.bot.sendSimpleMessage({
      to: req.user,
      message: 'Give me a moment...'
    })

    const check = this.draftCheck({ application, checks })
    try {
      await this.updateCheck({ req, application, check })
    } catch (error) {
      this.handleOnfidoError({ req, error })
    }
  }

  private updateCheck = async ({ req, application, check, form }: {
    req: any
    application: any
    check: Resource
    form?: any
  }) => {
    const onfidoApplicant = check.get('onfidoApplicant')
    const updatedApplicant = await this.applicants.createOrUpdate({ req, application, check, form })
    if (!updatedApplicant) return

    const uploadedAttachments = await this.uploadAttachments({ req, application, check, form })
    if (!uploadedAttachments) return

    if (this.hasRequiredAttachments({ application, check })) {
      await this.createOnfidoCheck({ req, application, check })
    }

    if (check.isModified()) {
      await check.signAndSave()
    }
  }

  private draftCheck = ({ application, checks }) => {
    let props
    const nonPending = checks.find(utils.isVirginCheck)
    if (nonPending) {
      props = nonPending
    } else {
      const { reports } = this.getProductOptions(application.requestFor)
      const aspects = getAspects(reports).join(', ')
      props = {
        provider: PROVIDER_NAME,
        message: utils.getMessageForAspects(aspects),
        reportsOrdered: getReportsOrderedEnumVals(reports),
        aspects,
        application: buildResource.stub({
          models,
          model: models[APPLICATION],
          resource: application
        }),
        applicant: application.applicant
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

    return this.bot.draft({
      type: onfidoModels.check.id,
      resource: props
    })
  }

  public ['onmessage:tradle.Form'] = async (req):Promise<any|void> => {
    if (this.mode !== 'during') return

    const { payload, application } = req
    if (!application) return

    const { applicant, requestFor } = application
    if (this.shouldIgnoreForm({ product: requestFor, form: payload[TYPE] })) {
      return
    }

    const form = _.cloneDeep(payload)
    const resolveEmbeds = this.bot.resolveEmbeds(form)
    const checks = await this.checks.listWithApplication(application._permalink)
    const pending = checks.find(utils.isPendingCheck)

    // nothing can be done until a check completes
    if (pending) {
      this.logger.debug(`check is already pending, ignoring form`, {
        form: form[TYPE],
        application: application._permalink
      })

      return
    }

    const check = this.draftCheck({ application, checks })
    await resolveEmbeds
    await this.handleForm({ req, application, check, form })
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

  public getPropertyMap = (productModelId:string):PropertyMap => {
    return this.products.find(({ product }) => product === productModelId).propertyMap
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
    this.logger.debug(`requesting edit`, {
      form: formType
    })

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

    if (!check.get('reportsOrdered')) {
      check.set('reportsOrdered', getReportsOrderedEnumVals(reports))
    }

    return await this.checks.create({ req, application, check, reports })
  }

  public unregisterWebhook = async ({ url }) => {
    await this.onfidoAPI.webhooks.unregister(url)
    await this.secrets.del({ key: this.webhookKey, context: ONFIDO_WEBHOOK_CONTEXT })
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

    const existing = await this.onfidoAPI.webhooks.list()

    let webhook
    if (existing) {
      webhook = existing.webhooks.find(w => {
        return w.url === url && events.every(e => w.events.includes(e))
      })

      if (webhook) {
        this.logger.debug('not registering, found existing', { id: webhook.id })
      }
    }

    if (!webhook) {
      this.logger.debug(`registering webhook`, { url })
      webhook = await this.onfidoAPI.webhooks.register({ url, events })
    }

    await this.secrets.update({
      key: this.webhookKey,
      value: webhook,
      context: ONFIDO_WEBHOOK_CONTEXT
    })

    return webhook
  }

  public getWebhook = async () => {
    const webhook = await this.secrets.get({
      key: this.webhookKey,
      context: ONFIDO_WEBHOOK_CONTEXT
    })

    if (typeof webhook === 'string' || Buffer.isBuffer(webhook)) {
      // @ts-ignore
      return JSON.parse(webhook)
    }

    return webhook
  }

  public processWebhookEvent = async (opts) => {
    this.logger.debug(`processing webhook event`)

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

    this.logger.debug(`updating check from webhook event`, {
      check: check.permalink
    })

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

    await this.updateCheck({ req, application, check, form })
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
    if (form) {
      if (type === form[TYPE]) return form
    } else if (req && req.payload && req.payload[TYPE] === type) {
      form = _.cloneDeep(req.payload)
      return await this.bot.resolveEmbeds(form)
    }

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

  private shouldIgnoreForm = ({ product, form }: {
    product: string
    form: string
  }) => {
    const productOpts = this.getProductOptions(product)
    if (!productOpts) {
      // this.logger.debug(`ignoring form for product`, { product, form })
      return true
    }

    const propertyMap = this.getPropertyMap(product)
    const hasMapping = Object.keys(propertyMap)
      .find(fieldName => propertyMap[fieldName].some(({ source }) => source === form))

    if (!hasMapping) {
      // this.logger.debug(`ignoring form with no extractable data`, { product, form })
      return true
    }

    if (!utils.isAddressRequired(productOpts.reports)) {
      const relevant = Object.keys(PROPERTY_SETS).filter(name => {
        return PROPERTY_SETS[name].some(fieldName => utils.canExtractFromFormType({
          formType: form,
          fieldName,
          propertyMap
        }))
      })

      if (_.isEqual(relevant, ['address'])) {
        // this.logger.debug('address-related reports disabled, ignoring address-related form', {
        //   product,
        //   form
        // })

        return true
      }
    }
  }
}

export { Onfido }
const getStateKey = application => {
  return `${APPLICATION}_${application._permalink}_onfidoState`
}

const httpError = (status, message) => {
  const err:any = new Error(message)
  err.status = status
  return err
}

const getReportsOrderedEnumVals = (reports: string[]) => reports.map(id => buildResource.enumValue({
  model: onfidoModels.reportType,
  value: id
}))

const getAspects = (reports: string[]) => reports.map(report => REPORT_TO_ASPECT[report])
