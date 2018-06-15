import _ = require('lodash')
import parseDataUri = require('parse-data-uri')
import { TYPE } from '@tradle/constants'
import models from './models'
import onfidoModels from './onfido-models'
import {
  ApplicantProps,
  ILogger,
  Document,
  Resource
} from './types'

import {
  getFormsToCreateApplicant,
  getApplicantProps,
  parseStub,
  hasTwoSides,
  getExtension,
  digest,
  ensureNoPendingCheck,
  sanitize,
  stubFromParsedStub,
  getFormStubs,
  isAddressRequired
} from './utils'

import APIUtils from './api-utils'
import {
  IOnfidoComponent,
  OnfidoState
} from './types'

import { Onfido } from './'
import {
  APPLICANT,
  SELFIE,
  PHOTO_ID
} from './constants'

export default class Applicants implements IOnfidoComponent {
  public bot: any
  public onfidoAPI: any
  public applications: any
  public logger: ILogger
  public apiUtils: APIUtils
  public padApplicantName: boolean
  public preCheckAddress: boolean
  private main: Onfido
  constructor (main:Onfido) {
    this.main = main
    this.bot = main.bot
    this.onfidoAPI = main.onfidoAPI
    this.applications = main.applications
    this.logger = main.logger
    this.apiUtils = main.apiUtils
    this.padApplicantName = main.padApplicantName
    this.preCheckAddress = main.preCheckAddress
  }

  public createOrUpdate = async ({ req, application, check, form }: OnfidoState) => {
    if (!check) {
      throw new Error('expected "check"')
    }

    const { models } = this.bot
    const productOptions = this.main.getProductOptions(application.requestFor)
    const propertyMap = this.main.getPropertyMap(application.requestFor)
    const fStub = form && this.apiUtils.stub(form)
    const parsedStubs = getFormsToCreateApplicant({
      models,
      forms: getFormStubs(application).concat(fStub ? parseStub(fStub) : []),
      reports: productOptions.reports,
      propertyMap
    })

    if (!parsedStubs) {
      this.logger.debug(`not enough info to create an applicant (yet)`, {
        application: application._permalink
      })

      return false
    }

    const parsedStubsAndForms = parsedStubs.slice()
    const forms = await Promise.all(parsedStubsAndForms.map(item => this.apiUtils.getResource(item, req)))
    const props = getApplicantProps({ models, forms, propertyMap })
    const { first_name, last_name, dob, addresses=[] } = props
    const needAddress = isAddressRequired(productOptions.reports)
    if (!needAddress) addresses.length = 0

    if (!(first_name && last_name && dob && (addresses.length || !needAddress))) {
      return false
    }

    if (addresses.length && this.preCheckAddress) {
      await this.apiUtils.checkAddress({ address: addresses[0] })
    }

    const applicant = parseStub(application.applicant).permalink

    if (this.padApplicantName) {
      // to ensure uniqueness during testing
      props.last_name += applicant.slice(0, 4)
    }

    const isUpdate = !!check.get('onfidoApplicant')
    const verb = isUpdate ? 'updating' : 'creating'
    this.logger.debug(`${verb} applicant`, {
      application: application._permalink
    })

    let onfidoApplicant
    try {
      if (isUpdate) {
        onfidoApplicant = await this.update({ req, application, check, props })
      } else {
        onfidoApplicant = await this.onfidoAPI.applicants.create(props)
      }
    } catch (err) {
      this.logger.error(`failed to create or update applicant ${applicant}`, err)
      throw err
    }

    if (onfidoApplicant) {
      check.set({
        onfidoApplicant: this.apiUtils.sanitize(onfidoApplicant),
        applicantDetails: parsedStubs.map(stubFromParsedStub)
      })
    }

    return true
  }

  public update = async ({ req, application, check, form, props }: {
    application: any
    check: Resource
    req?: any
    form?: any
    props?: any
  }):Promise<any|void> => {
    if (!props) {
      if (!form) {
        throw new Error('expected "form" or "props')
      }

      props = getApplicantProps({
        models: this.bot.models,
        forms: [form],
        propertyMap: this.main.getPropertyMap(application.requestFor)
      })
    }

    if (props) {
      const current = check.get('onfidoApplicant')
      if (hasUpdate({ current, update: props })) {
        this.logger.debug('updating applicant', {
          application: application._permalink
        })

        return await this.onfidoAPI.applicants.update(current.id, props)
      }
    }
  }

  public uploadSelfie = async ({ req, application, check, form }: OnfidoState):Promise<boolean> => {
    ensureNoPendingCheck(check)
    if (!form) {
      throw new Error(`expected "form" to be ${SELFIE}`)
    }

    const { selfie } = form
    const { mimeType, data } = parseDataUri(selfie.url);

    this.logger.debug('uploading selfie', {
      application: application._permalink
    })

    try {
      const result = await this.onfidoAPI.applicants.uploadLivePhoto(check.get('onfidoApplicant').id, {
        file: data,
        filename: `live-photo-${digest(data)}.${getExtension(mimeType)}`
      })

      check.set({
        selfie: this.apiUtils.stub(form)
      })

      return true
    } catch (error) {
      // {
      //   "body": {
      //     "type": "validation_error",
      //     "message": "There was a validation error on this request",
      //     "fields": {
      //       "face_detection": [
      //         "Face not detected in image. Please note this validation can be disabled by setting the advanced_validation parameter to false."
      //       ]
      //     }
      //   },
      //   "status": 422
      // }

      this.logger.error('upload selfie failed', error)
      return await this.main.handleOnfidoError({ req, error })
    }
  }

  public uploadPhotoID = async ({ req, application, check, form }: OnfidoState) => {
    ensureNoPendingCheck(check)
    if (!form) {
      throw new Error(`expected "form" to be ${PHOTO_ID}`)
    }

    const { scan, documentType } = form
    const { mimeType, data } = parseDataUri(scan.url)
    const onfidoDocType = documentType.id === 'passport' ? 'passport' : 'driving_licence'
    const document:Document = {
      type: onfidoDocType,
      file: data,
      filename: `${onfidoDocType}-${digest(data)}.${getExtension(mimeType)}`
    }

    if (!hasTwoSides(documentType)) {
      document.side = 'front'
    }

    this.logger.debug('uploading photoID document', {
      application: application._permalink
    })

    try {
      await this.onfidoAPI.applicants.uploadDocument(check.get('onfidoApplicant').id, document)
      check.set({
        photoID: this.apiUtils.stub(form)
      })

      return true
    } catch (error) {
      await this.main.handleOnfidoError({ req, error })
    }

    return false
  }
}

const hasUpdate = ({ current, update }) => !_.isMatch(current, update)
