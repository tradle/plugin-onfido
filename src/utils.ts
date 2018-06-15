import crypto = require('crypto')
import _ = require('lodash')
import { TYPE } from '@tradle/constants'
import buildResource = require('@tradle/build-resource')
import validateResource = require('@tradle/validate-resource')
import validateModel = require('@tradle/validate-model')
import onfidoModels from './onfido-models'
import models from './models'
import { ApplicantProps, ProductOptions } from './types'
import {
  IPROOV_SELFIE,
  SELFIE,
  PHOTO_ID,
  VERIFICATION,
  REPORTS,
  PROPERTY_SETS,
  REQUIRED_ADDRESS_PROPS,
} from './constants'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const APPLICANT_PROPERTY_SETS = ['name', 'dob', 'address']
const APPLICANT_PROPERTY_SETS_MIN = ['name', 'dob']
const createFilterForType = query => ({ type }) => type === query
const { sanitize, parseEnumValue } = validateResource.utils
const { getRef } = validateModel.utils
const ONE_OR_MORE = 'One or more of the following checks'

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

export const canExtractFromFormType = ({ formType, fieldName, propertyMap }) => {
  const sources = propertyMap[fieldName]
  if (sources) {
    return sources.some(({ source }) => source === formType)
  }
}

export const extractFieldFromForm = ({ models, form, fieldName, propertyMap }) => {
  let sources = propertyMap[fieldName]
  if (!sources) return

  sources = sources.filter(({ source, property }) => {
    if (source !== form[TYPE]) return

    const topProp = typeof property === 'string' ? property : property[0]
    return form[topProp] != null
  })

  return find(sources, ({ property }) => {
    if (typeof property === 'string' || property.length === 1) return _.get(form, property)

    const model = models[form[TYPE]]
    const [propName, enumPropName] = property
    const propInfo = model.properties[propName]
    const ref = getRef(propInfo)
    if (ref) {
      const propModel = models[ref]
      if (propModel.subClassOf === 'tradle.Enum') {
        const enumVal = parseEnumValue({ model: propModel, value: form[propName] })
        return enumVal[enumPropName]
      }
    }

    return _.get(form, property)
  })
}

export const getFormsToCreateApplicant = ({ models, forms, reports, propertyMap }) => {
  const parsed = forms
    .slice()
    // .sort(sortDescendingByDate)
    .map(parseStub)

  const propSets = reports.includes('identity') ? APPLICANT_PROPERTY_SETS : APPLICANT_PROPERTY_SETS_MIN
  const required = _.flatMap(propSets, setName => {
    const fields = PROPERTY_SETS[setName]
    const sources = fields.map(fieldName => {
      return parsed.find(({ type }) => canExtractFromFormType({ formType: type, fieldName, propertyMap }))
    })

    if (sources.every(_.identity)) return sources
  })

  if (required.every(result => result)) {
    return _.uniqBy(required, ({ type }) => type)
  }
}

const hasRequiredAddressProps = props => {
  const ok = REQUIRED_ADDRESS_PROPS.every(prop => props[prop] != null)
  if (ok) {
    if (props.country === 'USA') return !!props.state

    return true
  }

  return false
}

export const getApplicantProps = ({ models, forms, propertyMap }):ApplicantProps => {
  const sets:any = APPLICANT_PROPERTY_SETS.reduce((sets, setName) => {
    sets[setName] = PROPERTY_SETS[setName].reduce((fields, fieldName) => {
      const val = find(forms, form => extractFieldFromForm({ models, fieldName, form, propertyMap }))
      if (val != null) {
        fields[fieldName] = val
      }

      return fields
    }, {})

    return sets
  }, {})

  const props:ApplicantProps = {}
  if (sets.name) Object.assign(props, sets.name)
  if (sets.dob) props.dob = normalizeDate(sets.dob.dob)
  if (sets.address && hasRequiredAddressProps(sets.address)) {
    props.addresses = [sets.address]
  }

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

// const sortDescendingByDate = (a, b) => {
//   return b._time - a._time
// }

export const find = (arr, filter) => {
  let result
  arr.some((el, i) => {
    const candidate = filter(el, i)
    if (candidate != null) {
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
  const { reports, propertyMap } = opts
  if (!(reports && Array.isArray(reports) && reports.length)) {
    throw new Error('expected "reports" array in product options')
  }

  const bad = reports.find(report => !REPORTS.includes(report))
  if (bad) {
    throw new Error(`report "${bad}" is invalid. Supported reports are: ${REPORTS.join(', ')}`)
  }

  // if (!propertyMap) throw new Error('expected "propertyMap"')
}

export const getFormStubs = application => (application.forms || [])
  .map(appSub => parseStub(appSub.submission))

export const isAddressRequired = (reports: string[]) => reports.includes('identity')

export const getStatus = (onfidoResult: string) => {
  if (onfidoResult === 'clear') return 'pass'
  if (onfidoResult === 'consider') return 'fail'

  return 'error'
}

export const getMessageForReports = (reports: string[], status?: string) => {
  const enumVals = onfidoModels.reportType.enum
  const titles = reports.map(id => enumVals.find(val => val.id === id).title)

  if (status) status = status.toLowerCase()

  const checks = `${titles.join(', ')}`
  const checkPhrase = reports.length > 1 ? ONE_OR_MORE : 'Check'
  if (status === 'pass') {
    return `Checks PASSED: ${checks}`
  }

  if (status === 'fail') {
    return `${checkPhrase} FAILED: ${checks}`
  }

  if (status === 'error') {
    return `${checkPhrase} hit an ERROR: ${checks}`
  }

  return `${checkPhrase} are still pending: ${checks}`
}
