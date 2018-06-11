import _ = require('lodash')
import Debug = require('debug')
import { TYPE } from '@tradle/constants'
import PROP_MAP from './onfido-tradle-mapping'
import {
  NAME,
  APPLICANT,
  ADDRESS,
  PG_PERSONAL_DETAILS,
  PHOTO_ID,
} from './constants'

import {
  normalizeDate
} from './utils'

import {
  OnfidoAddress
} from './types'

const packageName = require('../package.json').name
const debug = Debug(packageName + ':extractor')
const ADDRESS_PROPS = ['building_number', 'street', 'town', 'postcode', 'country']
const NAME_PROPS = ['first_name', 'last_name']

const createSubsetGetter = subset => form => {
  let mapping = PROP_MAP[form[TYPE]]
  if (!mapping) return

  mapping = _.pick(mapping, subset)
  let mapped
  try {
    mapped = _.transform(mapping, (result, pMapping, onfidoProp) => {
      const { tradle, transform = _.identity } = pMapping
      const val = transform(form[tradle])
      if (val != null) result[onfidoProp] = val
    }, {})
  } catch (err) {
    debug(`failed to extract props: ${subset.join(', ')}`, err)
  }

  return _.size(mapped) ? mapped : undefined
}

const toOnfidoName = createSubsetGetter(NAME_PROPS)
const getAddress:(form:any) => OnfidoAddress|void = createSubsetGetter(ADDRESS_PROPS)
const getDateOfBirth = (form:any):string|void => {
  let date
  const type = form[TYPE]
  if (type === APPLICANT || type === PG_PERSONAL_DETAILS || type === PHOTO_ID) {
    date = form.dateOfBirth
  }

  // else if (form[TYPE] === PHOTO_ID) {
  //   if (!form.scanJson) return

  //   const { personal } = form.scanJson
  //   if (!personal) return

  //   date = new Date(personal.dateOfBirth)
  // }

  if (date) {
    return normalizeDate(date)
  }
}

export const byProp = {
  name: {
    [NAME]: toOnfidoName,
    [APPLICANT]: toOnfidoName,
    [PG_PERSONAL_DETAILS]: toOnfidoName,
    [PHOTO_ID]: toOnfidoName
  },
  address: {
    [APPLICANT]: getAddress,
    [ADDRESS]: getAddress
  },
  dob: {
    [APPLICANT]: getDateOfBirth,
    [PG_PERSONAL_DETAILS]: getDateOfBirth,
    [PHOTO_ID]: getDateOfBirth
  }
}

export const byForm = _.transform(byProp, (result, formToExtractor, key) => {
  _.each(formToExtractor, (extractor, formType) => {
    _.set(result, [formType, key], extractor)
  })
}, {})

export const getExtractor = (field:string, fromFormType:string):Function|void => {
  return byProp[field][fromFormType]
}

export const canExtract = (field:string, fromFormType:string) => {
  return !!getExtractor(field, fromFormType)
}

export const extract = (field, fromFormType, form) => {
  const fn = getExtractor(field, fromFormType)
  return fn && fn(form)
}

export const hasField = (field:string) => field in byProp
export const hasForm = (formType:string) => formType in byForm
