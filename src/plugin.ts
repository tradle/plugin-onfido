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
  IncomingFormReq,
  OnfidoState,
  ProductOptions,
  OnfidoResult
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
import ONFIDO_PROP_INFO from './onfido-props'

import {
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
  validateProductOptions
} from './utils'

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
  public productsAPI:any
  public apiUtils: APIUtils
  public conf: any
  constructor (opts: PluginOpts) {
    const {
      logger,
      onfidoAPI,
      products,
      productsAPI,
      padApplicantName,
      formsToRequestCorrectionsFor,
      preCheckAddress,
      webhookKey=DEFAULT_WEBHOOK_KEY
      // onFinished
    } = opts

    this.logger = logger
    this.onfidoAPI = onfidoAPI

    products.forEach(validateProductOptions)
    this.products = products.map(opts => {
      return {
        ...opts,
        reports: opts.reports || DEFAULT_REPORTS
      }
    })

    this.productsAPI = productsAPI
    this.bot = productsAPI.bot
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

    let state
    let fresh
    try {
      const mapping = await this.getStatePointer({ application })
      state = await this.apiUtils.getResource({
        type: onfidoModels.state.id,
        permalink: mapping.state
      })
    } catch (err) {
      if (err.name !== 'NotFound') throw err

      fresh = true
      state = buildResource({
          models,
          model: onfidoModels.state,
        })
        .set({
          application,
          applicant
        })
        .toJSON()

      // yes, we might have to re-sign later
      // but if we don't, we won't be able to point to the state object
      state = await this.bot.sign(state)
      addLinks(state)
    }

    const type = payload[TYPE]
    let copy = _.cloneDeep(state)
    const { check } = state
    // nothing can be done until a check completes
    if (check) {
      this.logger.debug(`check is already pending, ignoring ${type}`)
      return
    }

    await this.handleForm({ req, application, state, form: payload })
    if (fresh) {
      await Promise.all([
        this.putStatePointer({ application, state }),
        this.bot.save(state)
      ])
    } else if (!_.isEqual(state, copy)) {
      await this.bot.versionAndSave(state)
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

  private getProductOptions = (productModelId:string):ProductOptions => {
    return this.products.find(({ product }) => product === productModelId)
  }

  private putStatePointer = async ({ application, state }) => {
    await this.bot.kv.put(getStateKey(application), { state: state._permalink })
  }

  private getStatePointer = async ({ application }) => {
    return await this.bot.kv.get(getStateKey(application))
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

    const { user, application } = req
    const form = this.productsAPI.state.getLatestFormByType(application.forms, formType)
    if (!form) {
      this.logger.error(`failed to find form for property: ${onfidoProp}`)
      throw error
    }

    const message = propInfo.error || Errors.INVALID_VALUE
    if (formType === SELFIE) {
      await this.productsAPI.requestItem({
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
    await this.productsAPI.requestEdit({
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

  public createCheck = async ({ req, application, state, saveState, reports }: {
    req?: any
    reports?: string[]
    application: any
    state: any
    saveState: boolean
  }) => {
    this.ensureProductSupported({ application })

    if (!state[SIG]) {
      state = await this.bot.sign(state)
    }

    if (!reports) {
      ({ reports } = this.getProductOptions(application.requestFor))
    }

    try {
      return await this.checks.create({ req, application, state, reports, saveState })
    } finally {
      await this.bot.save(state)
    }
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

  public processWebhookEvent = async ({ req, body, desiredResult }: {
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
      applicantId = parseCheckURL(object).applicantId
    } else {
      const msg = 'unknown resource_type: ' + resource_type
      this.logger.warn(msg)
      throw httpError(400, msg)
    }

    const loadSavedData = this.checks.lookupByCheckId(checkId)
    const getApplicantId = applicantId
      ? Promise.resolve(applicantId)
      : loadSavedData.then(({ state }) => state.onfidoApplicant.id)

    const getUpdatedCheck = this.checks.fetch({
      applicantId: await getApplicantId,
      checkId
    })

    const [savedData, update] = await Promise.all([
      loadSavedData,
      getUpdatedCheck
    ])

    const { application, state, check } = savedData
    await this.checks.processCheck({
      application,
      state,
      current: check,
      update,
      saveState: true
    })
  }

  private handleForm = async (opts: IncomingFormReq) => {
    try {
      await this._handleForm(opts)
    } catch (error) {
      await this.handleOnfidoError({ req: opts.req, error })
      return
    }
  }

  private _handleForm = async ({ req, application, state, form }: IncomingFormReq) => {
    const type = form[TYPE]
    const { pendingCheck, onfidoApplicant, selfie, photoID } = state

    if (pendingCheck) {
      const { result } = state
      if (result) {
        this.logger.info(`received ${type} but already have a check complete. Ignoring for now.`)
      } else {
        this.logger.info(`received ${type} but already have a check pending. Ignoring for now.`)
      }

      return
    }

    if (onfidoApplicant) {
      const ok = await this.updateApplicant({ req, application, state, form })
      if (!ok) return
    } else {
      const ok = await this.applicants.createOrUpdate({ req, application, state, form })
      if (!ok) return
    }

    await this.uploadAttachments({ req, application, state, form })
    if (state.photoID && state.selfie) {
      await this.createCheck({ req, application, state, saveState: false })
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

  public updateApplicant = async ({ req, application, state, form }: OnfidoState):Promise<boolean> => {
    try {
      await this.applicants.update({ req, application, state, form })
      return true
    } catch (error) {
      await this.handleOnfidoError({ req, error })
      return false
    }
  }

  public uploadAttachments = async ({ req, application, state, form }: OnfidoState):Promise<boolean> => {
    if (!state.selfie) {
      const selfie = await this.getForm({ type: SELFIE, application, form, req })
      if (selfie) {
        const ok = await this.applicants.uploadSelfie({ req, application, state, form: selfie })
        if (!ok) return false
      }
    }

    if (!state.photoID) {
      const photoID = await this.getForm({ type: PHOTO_ID, application, form, req })
      if (photoID) {
        const ok = await this.applicants.uploadPhotoID({ req, application, state, form: photoID })
        if (!ok) return false
      }
    }

    return true
  }

  public getState = async (permalink:string) => {
    return await this.apiUtils.getResource({
      type: onfidoModels.state.id,
      permalink
    })
  }

  public listStates = async (opts) => {
    return await this.bot.db.find({
      ...opts,
      filter: {
        EQ: {
          [TYPE]: onfidoModels.state.id
        }
      }
    })
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
}

export { Onfido }
const getStateKey = application => {
  return `${APPLICATION}_${application._permalink}_onfidoState`
}

const httpError = (status, message) => {
  const err:any = new Error('message')
  err.status = status
  return err
}
