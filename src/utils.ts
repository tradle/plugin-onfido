import crypto = require('crypto')
import _ = require('lodash')
import { TYPE } from '@tradle/constants'
import buildResource = require('@tradle/build-resource')
import validateResource = require('@tradle/validate-resource')
import onfidoModels from './onfido-models'
import models from './models'
import { ApplicantProps, ProductOptions } from './types'
import {
  IPROOV_SELFIE,
  SELFIE,
  PHOTO_ID,
  VERIFICATION,
  REPORTS
} from './constants'

import * as Extractor from './extractor'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const APPLICANT_PROPERTY_SETS = ['name', 'dob', 'address']
const APPLICANT_PROPERTY_SETS_MIN = ['name', 'dob']
const createFilterForType = query => ({ type }) => type === query
const { sanitize } = validateResource.utils

export { sanitize }

export const getLatestFormByType = (application:any, type:string) => {
  return getLatestForm(application, createFilterForType(type))
}

export const getLatestForm = (application:any, filter:Function) => {
  return getFormStubs(application).find(parsed => filter(parsed))
}

export const parseStub = validateResource.utils.parseStub

export const getPhotoID = (application) => {
  return getLatestForm(application, ({ type }) => type === PHOTO_ID)
}

export const getSelfie = (application) => {
  return getLatestForm(application, ({ type }) => type === SELFIE)
}

export const firstProp = obj => {
  for (let k in obj) {
    return k
  }
}

export const parseReportURL = url => {
  url = url.href || url
  const [match, checkId, reportId] = url.match(/(?:\/checks\/([^/]+))?\/reports\/([^/]+)/)
  return { checkId, reportId }
}

export const parseCheckURL = url => {
  url = url.href || url
  const [match, applicantId, checkId] = url.match(/(?:\/applicants\/([^/]+))?\/checks\/([^/]+)/)
  return { applicantId, checkId }
}

export const getOnfidoCheckIdKey = checkId => {
  return `onfido_check_${checkId}`
}

export const getFormsToCreateApplicant = ({ forms, reports }) => {
  const parsed = forms
    .slice()
    .sort(sortDescendingByDate)
    .map(parseStub)

  const propSets = reports.includes('identity') ? APPLICANT_PROPERTY_SETS : APPLICANT_PROPERTY_SETS_MIN
  const required = propSets.map(field => {
    return parsed.find(({ type }) => Extractor.canExtract(field, type))
  })

  if (required.every(result => result)) {
    return _.uniqBy(required, ({ type }) => type)
  }
}

export const isApplicantInfoForm = type => Extractor.hasForm(type)
export const getApplicantProps = (forms):ApplicantProps => {
  const {
    name,
    address,
    dob
  }:any = APPLICANT_PROPERTY_SETS.reduce((fields, field) => {
    fields[field] = find(forms, form => {
      return Extractor.extract(field, form[TYPE], form)
    })

    return fields
  }, {})

  const props:ApplicantProps = {}
  if (name) Object.assign(props, name)
  if (dob) props.dob = dob
  if (address) props.addresses = [address]

  return props
}

export const normalizeDate = (date):string => {
  if (typeof date === 'string') {
    if (ISO_DATE.test(date)) {
      return date
    }
  }

  date = new Date(date) // danger!
  return toYYYY_MM_DD_UTC(date, '-')
}

// courtesy of http://stackoverflow.com/questions/3066586/get-string-in-yyyymmdd-format-from-js-date-object
export const toYYYY_MM_DD_UTC = (date, separator):string => {
  const mm = date.getUTCMonth() + 1 // getUTCMonth() is zero-based
  const dd = date.getUTCDate()
  return [
    date.getUTCFullYear(),
    (mm>9 ? '' : '0') + mm,
    (dd>9 ? '' : '0') + dd
  ].join(separator || '')
}

const sortDescendingByDate = (a, b) => {
  return b.time - a.time
}

export const find = (arr, filter) => {
  let result
  arr.some((el, i) => {
    const candidate = filter(el, i)
    if (candidate) {
      return result = candidate
    }
  })

  return result
}

export const equalish = (a, b) => {
  return stringifyAndNormalize(a) === stringifyAndNormalize(b)
}

export const stringifyAndNormalize = (val) => {
  return String(val).trim().toLowerCase()
}

const mimeTypeToExt = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'application/pdf': 'pdf',
  'image/gif': 'gif',
}

export const getExtension = (mimeType) => {
  return mimeTypeToExt[mimeType] || mimeType.split('/')[1]
}

export const digest = (data) => {
  return crypto.createHash('sha256').update(data).digest('hex').slice(0, 7)
}

export const hasTwoSides = (onfidoType) => {
  return onfidoType !== 'passport'
}

export const pickNonNull = obj => {
  const defined = {}
  for (let key in obj) {
    let val = obj[key]
    if (val != null) {
      defined[key] = val
    }
  }

  return defined
}

export const isVirginCheck = check => !check.onfidoStatus

export const isPendingCheck = check => {
  return check.onfidoStatus && getEnumValueId(check.onfidoStatus) === 'inprogress'
}

export const ensureNoPendingCheck = check => {
  if (isPendingCheck(check)) {
    throw new Error('cannot upload selfie until pending check is resolved')
  }
}

// export const setProcessStatus = (state, value) => {
//   state.status = buildResource.enumValue({
//     model: onfidoModels.processStatus,
//     value
//   })
// }

export const getEnumValueId = (value) => {
  const type = (value.id || value).split('_')[0]
  const model = onfidoModels.all[type]
  const parsed = validateResource.utils.parseEnumValue({ model, value })
  return parsed.id
}

export const getCompletedReports = ({ current, update }) => {
  if (!current) return update.reports.filter(isComplete)

  return update.reports.filter(report => {
    if (!isComplete(report)) return

    const match = current.reports.find(r => r.id === report.id)
    if (match) return !isComplete(match)
  })
}

export const createOnfidoVerification = ({ applicant, form, report }) => {
  const aspect = report.name === 'facial_similarity' ? 'facial similarity' : 'authenticity'
  const method:any = {
    [TYPE]: 'tradle.APIBasedVerificationMethod',
    api: {
      [TYPE]: 'tradle.API',
      name: 'onfido'
    },
    reference: [{ queryId: 'report:' + report.id }],
    aspect,
    rawData: report
  }

  const score = report && report.properties && report.properties.score
  if (typeof score === 'number') {
    method.confidence = score
  }

  return buildResource({
      models,
      model: VERIFICATION
    })
    .set({
      document: form,
      method
      // documentOwner: applicant
    })
    .toJSON()
}

export const isComplete = (onfidoObject) => {
  return (onfidoObject.status || '').indexOf('complete') !== -1
}

export const addLinks = (resource) => {
  buildResource.setVirtual(resource, {
    _link: buildResource.link(resource),
    _permalink: buildResource.permalink(resource)
  })
}

export const stubFromParsedStub = stub => {
  const { type, link, permalink, title } = parseStub(stub)
  const fixed:any = {
    [TYPE]: type,
    _link: link,
    _permalink: permalink
  }

  if (title) fixed._displayName = title

  return fixed
}

export const validateProductOptions = (opts:ProductOptions):void => {
  const { reports } = opts
  if (!(reports && Array.isArray(reports) && reports.length)) {
    throw new Error('expected "reports" array in product options')
  }

  const bad = reports.find(report => !REPORTS.includes(report))
  if (bad) {
    throw new Error(`report "${bad}" is invalid. Supported reports are: ${REPORTS.join(', ')}`)
  }
}

export const getFormStubs = application => (application.forms || [])
  .map(appSub => parseStub(appSub.submission))
