import deepEqual = require('deep-equal')
import parseDataUri = require('parse-data-uri')
import { TYPE } from '@tradle/constants'
import onfidoModels from './onfido-models'
import {
  ApplicantProps,
  ILogger
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
  stubFromParsedStub
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
  public productsAPI: any
  public logger: ILogger
  public apiUtils: APIUtils
  public padApplicantName: boolean
  public preCheckAddress: boolean
  private main: Onfido
  constructor (main:Onfido) {
    this.main = main
    this.bot = main.productsAPI.bot
    this.onfidoAPI = main.onfidoAPI
    this.productsAPI = main.productsAPI
    this.logger = main.logger
    this.apiUtils = main.apiUtils
    this.padApplicantName = main.padApplicantName
    this.preCheckAddress = main.preCheckAddress
  }

  public createOrUpdate = async ({ req, application, state, form }: OnfidoState) => {
    if (!state) {
      throw new Error('expected "state"')
    }

    const fStub = form && this.apiUtils.stub(form)
    const parsedStubs = getFormsToCreateApplicant({
      forms: application.forms.concat(fStub || [])
    })

    if (!parsedStubs) {
      this.logger.debug(`don't have the requisite forms to create an applicant`)
      return false
    }

    const parsedStubsAndForms = parsedStubs.slice()
    if (form) {
      const idx = parsedStubs.findIndex(stub => stub.id === fStub.id)
      if (idx !== -1) {
        // no need to look this one up, we already have the body
        parsedStubsAndForms[idx] = form
      }
    }

    const forms = await Promise.all(parsedStubsAndForms.map(item => this.apiUtils.getResource(item)))
    const props = getApplicantProps(forms)
    const { first_name, last_name, dob, addresses=[] } = props
    if (!(first_name && last_name && dob && addresses.length)) {
      return false
    }

    if (this.preCheckAddress) {
      await this.apiUtils.checkAddress({ address: addresses[0] })
    }

    const applicant = parseStub(application.applicant).permalink
    // to ensure uniqueness during testing
    if (this.padApplicantName) {
      props.last_name += applicant.slice(0, 4)
    }

    if (state.onfidoApplicant) {
      return await this.update({ req, application, state, props })
    }

    try {
      const onfidoApplicant = await this.onfidoAPI.applicants.create(props)
      state.onfidoApplicant = sanitize(onfidoApplicant).sanitized
      this.apiUtils.setProps(state, {
        applicantDetails: parsedStubs.map(stubFromParsedStub)
      })
      return true
    } catch (err) {
      this.logger.error(`failed to create applicant ${applicant}`, err)
      throw err
    }
  }

  // public create = async ({ req, state, application, form }) => {
  //   const forms = application.forms.concat(form)
  //   const parsedStubs = getFormsToCreateApplicant(application)

  //   const props = getApplicantProps([form])
  //   return this.onfidoAPI.applicants.update()
  // }

  public update = async ({ req, application, state, form, props }: {
    application: any
    state: any
    req?: any
    form?: any
    props?: any
  }):Promise<boolean> => {
    if (!props) {
      if (!form) {
        throw new Error('expected "form" or "props')
      }

      props = getApplicantProps([form])
    }

    if (props) {
      if (hasUpdate({ current: state.onfidoApplicant, update: props })) {
        await this.onfidoAPI.applicants.update(props)
      }

      return true
    }

    return false
  }

  public uploadSelfie = async ({ req, application, state, form }: OnfidoState):Promise<boolean> => {
    ensureNoPendingCheck(state)
    if (!form) {
      throw new Error(`expected "form" to be ${SELFIE}`)
    }

    const { selfie } = form
    const { mimeType, data } = parseDataUri(selfie.url)
    this.logger.debug('uploading selfie')
    try {
      const result = await this.onfidoAPI.applicants.uploadLivePhoto(state.onfidoApplicant.id, {
        file: data,
        filename: `live-photo-${digest(data)}.${getExtension(mimeType)}`
      })

      this.logger.debug('uploaded selfie')
      this.apiUtils.setProps(state, { selfie: form })
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

      this.logger.error('upload live photo failed', error)
      return await this.main.handleOnfidoError({ req, error })
    }
  }

  public uploadPhotoID = async ({ req, application, state, form }: OnfidoState) => {
    ensureNoPendingCheck(state)
    if (!form) {
      throw new Error(`expected "form" to be ${PHOTO_ID}`)
    }

    const { scan, documentType } = form
    const { mimeType, data } = parseDataUri(scan.url)
    const onfidoDocType = documentType.id === 'passport' ? 'passport' : 'driving_licence'
    const document = {
      type: onfidoDocType,
      file: data,
      filename: `${onfidoDocType}-${digest(data)}.${getExtension(mimeType)}`
    }

    if (!hasTwoSides(documentType)) {
      document.side = 'front'
    }

    this.logger.debug('uploading document')
    try {
      await this.onfidoAPI.applicants.uploadDocument(state.onfidoApplicant.id, document)
      this.apiUtils.setProps(state, { photoID: form })
      return true
    } catch (error) {
      await this.main.handleOnfidoError({ req, error })
    }

    return false
  }
}

const hasUpdate = ({ current, update }) => {
  return Object.keys(update).some(key => {
    return !deepEqual(update[key], current[key])
  })
}
