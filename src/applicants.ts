import deepEqual = require('deep-equal')
import parseDataUri = require('parse-data-uri')
import { TYPE } from '@tradle/constants'
import onfidoModels from './onfido-models'
import {
  ApplicantProps,
  Logger
} from './types'

import {
  getFormsToCreateApplicant,
  getApplicantProps,
  parseStub,
  hasTwoSides,
  getExtension,
  digest,
  ensureNoPendingCheck
} from './utils'

import APIUtils from './api-utils'
import {
  IOnfidoComponent,
  IncomingFormReq
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
  public logger: ILogger
  public apiUtils: APIUtils
  public padApplicantName: boolean
  public models: any
  private main: Onfido
  constructor (main:Onfido) {
    this.models = main.models
    this.bot = main.productsAPI.bot
    this.onfidoAPI = main.onfidoAPI
    this.logger = main.logger
    this.apiUtils = main.apiUtils
    this.padApplicantName = main.padApplicantName
  }

  public createOrUpdate = async ({ req, application, state, form }: IncomingFormReq) => {
    if (!state) {
      throw new Error('expected "state"')
    }

    const stubsAndForms = getFormsToCreateApplicant(application)
    if (!stubsAndForms) {
      this.logger.debug(`don't have the requisite forms to create an applicant`)
      return false
    }

    if (form) {
      const fStub = this.apiUtils.stub(form)
      const idx = stubsAndForms.findIndex(stub => stub.id === fStub.id)
      if (idx !== -1) {
        // no need to look this one up, we already have the body
        stubsAndForms[idx] = form
      }
    }

    const forms = await Promise.all(stubsAndForms.map(item => this.apiUtils.getResource(item)))
    const props = getApplicantProps(forms)
    const { name, dob, addresses } = props
    if (!(name && dob && addresses && addresses.length)) {
      return false
    }

    await this.apiUtils.checkAddress({ address: addresses[0] })

    const applicant = parseStub(application.applicant).permalink
    // to ensure uniqueness during testing
    if (this.padApplicantName) {
      props.name.last_name += applicant.slice(0, 4)
    }

    if (state.onfidoApplicant) {
      const isDiff = Object.keys(props).some(key => {
        return !deepEqual(props[key], state.onfidoApplicant[key])
      })

      if (!isDiff) {
        this.logger.debug('skipping update, no changes to push')
        return false
      }

      try {
        await this.onfidoAPI.applicants.update(props)
        return true
      } catch (err) {
        this.logger.error(`failed to update applicant ${applicant}`, err)
        throw err
      }
    }

    try {
      state.onfidoApplicant = await this.onfidoAPI.applicants.create(props)
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

  public update = async ({ req, application, state, form }: IncomingFormReq):Promise<boolean> => {
    if (!form) {
      throw new Error(`expected "form"`)
    }

    const props = getApplicantProps([form])
    if (props && Object.keys(props).length) {
      await this.onfidoAPI.applicants.update(props)
      return true
    }

    return false
  }

  public uploadSelfie = async ({ req, application, state, form }: IncomingFormReq):Promise<boolean> => {
    ensureNoPendingCheck(state)
    if (!form) {
      throw new Error(`expected "form" to be ${SELFIE}`)
    }

    const { selfie } = await this.apiUtils.getResource(form)
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

  public uploadPhotoID = async ({ req, application, state, form }: IncomingFormReq) => {
    ensureNoPendingCheck(state)
    if (!form) {
      throw new Error(`expected "form" to be ${PHOTO_ID}`)
    }

    const { scan, documentType } = await this.apiUtils.getResource(form)
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

  public get = async (permalink:string) => {
    return await this.apiUtils.getResource({
      type: onfidoModels.state.id,
      permalink
    })
  }

  public list = async (opts) => {
    return await this.bot.db.find({
      ...opts,
      filter: {
        EQ: {
          [TYPE]: onfidoModels.state.id
        }
      }
    })
  }
}
