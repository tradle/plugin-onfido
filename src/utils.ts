import crypto = require('crypto')
import { TYPE } from '@tradle/constants'
import buildResource = require('@tradle/build-resource')
import validateResource = require('@tradle/validate-resource')
import onfidoModels from './onfido-models'
import models from './models'
import { ApplicantProps } from './types'

import {
  IPROOV_SELFIE,
  SELFIE,
  PHOTO_ID,
  VERIFICATION
} from './constants'

import Extractor from './extractor'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const APPLICANT_PROPERTY_SETS = ['name', 'address', 'dob']
const createFilterForType = query => ({ type }) => type === query
const { sanitize } = validateResource.utils

export { sanitize }

export const getLatestFormByType = (application:any, type:string) => {
  return getLatestForm(application, createFilterForType(type))
}

export const getLatestForm = (application:any, filter:Function) => {
  let result
  application.forms.slice().sort(sortDescendingByDate).some(stub => {
    const parsed = parseStub(stub)
    if (filter(parsed)) {
      result = parsed
      return true
    }
  })

  return result
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
  const [match, checkId, reportId] = url.match(/\/checks\/([a-zA-Z0-9-_]+)\/reports\/([a-zA-Z0-9-_]+)/)
  return { checkId, reportId }
}

export const parseCheckURL = url => {
  url = url.href || url
  const [match, applicantId, checkId] = url.match(/\/applicants\/([a-zA-Z0-9-_]+)\/checks\/([a-zA-Z0-9-_]+)/)
  return { applicantId, checkId }
}

export const getOnfidoCheckIdKey = checkId => {
  return `onfido_check_${checkId}`
}

export const haveFormsToCreateApplicant = application => {
  return !!getFormsToCreateApplicant(application)
}

export const getFormsToCreateApplicant = application => {
  const parsed = application.forms.slice().sort(sortDescendingByDate).map(stub => parseStub(stub))
  const required = APPLICANT_PROPERTY_SETS.map(propertySet => {
    return parsed.find(({ type }) => Extractor[propertySet][type])
  })

  if (required.every(result => result)) {
    return unique(required)
  }
}

export const unique = arr => {
  const map = new Map()
  const uniq = []
  for (const item of arr) {
    if (!map.has(item)) {
      map.set(item, true)
      uniq.push(item)
    }
  }

  return uniq
}

export const isApplicantInfoForm = type => {
  return Object.keys(Extractor).find(propertySet => Extractor[propertySet][type])
}

export const getApplicantProps = (forms):ApplicantProps => {
  const {
    name,
    address,
    dob
  } = APPLICANT_PROPERTY_SETS.reduce((result, propertySet) => {
    result[propertySet] = find(forms, form => {
      const extractor = Extractor[propertySet][form[TYPE]]
      if (extractor) return extractor(form)
    })

    return result
  }, {})

  const props:ApplicantProps = {}
  if (name) Object.assign(props, name)
  if (dob) props.dob = dob
  if (address) props.addresses = [address]

  return props
}

export const normalizeDate = (date) => {
  if (typeof date === 'string') {
    if (ISO_DATE.test(date)) {
      return date
    }
  }

  date = new Date(date) // danger!
  return toYYYY_MM_DD_UTC(date, '-')
}

// courtesy of http://stackoverflow.com/questions/3066586/get-string-in-yyyymmdd-format-from-js-date-object
export const toYYYY_MM_DD_UTC = (date, separator) => {
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

export const ensureNoPendingCheck = state => {
  if (state.checkStatus && getEnumValueId(state.checkStatus) === 'inprogress') {
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
  const method = {
    [TYPE]: 'tradle.APIBasedVerificationMethod',
    api: {
      [TYPE]: 'tradle.API',
      name: 'onfido',
      provider: {
        id: 'tradle.Organization_57f54fd7a5dd777a541ca994f3155aaecd656bc05ac52e6163a2311d2d4b8b87_57f54fd7a5dd777a541ca994f3155aaecd656bc05ac52e6163a2311d2d4b8b87',
        title: 'Onfido'
      }
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

export const batchify = (arr, batchSize) => {
  const batches = []
  while (arr.length) {
    batches.push(arr.slice(0, batchSize))
    arr = arr.slice(batchSize)
  }

  return batches
}

export const stubFromParsedStub = (parsedStub) => {
  const id = buildResource.id(parsedStub)
  const stub = { id }
  if (parsedStub.title) {
    stub.title = parsedStub.title
  }

  return stub
}
