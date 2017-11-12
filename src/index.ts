import deepEqual = require('deep-equal')
import clone = require('clone')
import buildResource = require('@tradle/build-resource')
import { TYPE, SIG } from '@tradle/constants'
import mergeModels = require('@tradle/merge-models')
import onfidoModels from './onfido-models'
import Applicants from './applicants'
import Checks from './checks'
import {
  ILogger,
  IOnfidoComponent,
  PluginOpts,
  IncomingFormReq,
  OnfidoState
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
  APPLICATION
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
  addLinks
} from './utils'

// const REQUEST_EDITS_FOR = {
//   [APPLICANT]: true,
//   [SELFIE]: true
// }

const DEFAULT_REPORTS = onfidoModels.reportType.enum.map(({ id }) => id)

export class Onfido implements IOnfidoComponent {
  public applicants:Applicants
  public checks:Checks
  public bot:any
  public products:string[]
  public padApplicantName:boolean
  public formsToRequestCorrectionsFor:string[]
  public preCheckAddress:boolean
  public webhookKey:string
  public logger:ILogger
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
      preCheckAddress,
      webhookKey=DEFAULT_WEBHOOK_KEY
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
    if (!this.products.includes(requestFor)) {
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
          models: this.models,
          model: onfidoModels.state,
        })
        .set({
          application,
          applicant
        })
        .toJSON()

      // yes, we might have to re-sign later
      // but if we don't, we won't be able to point to the state object
      await this.bot.sign(state)
      addLinks(state)
    }

    const type = payload[TYPE]
    let copy = clone(state)
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
    } else if (!deepEqual(state, copy)) {
      await this.bot.versionAndSave(state)
    }
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

  public createCheck = async ({ req, application, state, reports=DEFAULT_REPORTS }) => {
    if (!state[SIG]) {
      await this.bot.sign(state)
    }

    try {
      return await this.checks.create({ req, application, state, reports })
    } finally {
      await this.bot.save(state)
    }
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
    await this.bot.conf.put(this.webhookKey, webhook)
    return webhook
  }

  public processWebhookEvent = async ({ req, res, desiredResult }) => {
    let webhook
    try {
      webhook = await this.bot.conf.get(this.webhookKey)
    } catch (err) {
      throw new Error('webhook not found')
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
    let applicantId
    if (resource_type === 'report') {
      checkId = parseReportURL(object).checkId
    } else if (resource_type === 'check') {
      checkId = object.id
      applicantId = parseCheckURL(object)
    } else {
      this.logger.warn('unknown resource_type: ' + resource_type)
      return res.status(404).end()
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
      update
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
      await this.createCheck({ req, application, state })
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
      const selfie = await this.getForm({ type: SELFIE, application, form })
      if (selfie) {
        const ok = await this.applicants.uploadSelfie({ req, application, state, form: selfie })
        if (!ok) return false
      }
    }

    if (!state.photoID) {
      const photoID = await this.getForm({ type: PHOTO_ID, application, form })
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

  private getForm = async ({ type, application, form }) => {
    if (type === form[TYPE]) return form

    const parsedStub = getLatestFormByType(application, type)
    if (parsedStub) {
      return await this.apiUtils.getResource(parsedStub)
    }
  }
}

export default opts => new Onfido(opts)

const getStateKey = application => {
  return `${APPLICATION}_${application._permalink}_onfidoState`
}
