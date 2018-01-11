import _ = require('lodash')
import Debug = require('debug')
import { TYPE } from '@tradle/constants'
import ONFIDO_PROP_INFO from './onfido-props'
import {
  NAME,
  APPLICANT,
  ADDRESS
} from './constants'

import {
  normalizeDate
} from './utils'

import {
  OnfidoAddress
} from './types'

const packageName = require('../package.json').name
const debug = Debug(packageName + ':extractor')
const ADDRESS_PROPS = ['building_number', 'street', 'town', 'postcode']

const toOnfidoName = name => {
  const first_name = name.firstName || name.givenName
  const last_name = name.lastName || name.surname
  if (first_name && last_name) {
    return { first_name, last_name }
  }
}

const getAddress = (form:any):OnfidoAddress => {
  const countryCode = getCountryCode(form.country)
  if (!countryCode) {
    debug(`ignoring address with country "${form.country.title}", don't know country 3-letter country code`)
    return
  }

  const address = {
    country: countryCode
  } as OnfidoAddress

  ADDRESS_PROPS.forEach(prop => {
    const propInfo = ONFIDO_PROP_INFO[prop]
    if (typeof propInfo !== 'undefined') {
      address[prop] = form[propInfo.tradle]
    }
  })

  if (form.subStreet) address.sub_street = form.subStreet
  if (form.flatNumber) address.flat_number = form.flatNumber

  return address
}

const getDateOfBirth = (form:any):string|void => {
  let date
  if (form[TYPE] === APPLICANT) {
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

const getCountryCode = (country) => {
  switch (country.title.trim().toLowerCase()) {
    case 'united kingdom':
      return 'GBR'
    case 'new zealand':
      return 'NZL'
  }
}

export const byProp = {
  name: {
    [NAME]: toOnfidoName,
    [APPLICANT]: toOnfidoName
  },
  address: {
    [APPLICANT]: getAddress,
    [ADDRESS]: getAddress
  },
  dob: {
    [APPLICANT]: getDateOfBirth
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
