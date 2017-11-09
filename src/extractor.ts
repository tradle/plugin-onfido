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

import { name as packageName } from '../package.json'

const debug = Debug(packageName + ':extractor')
const ADDRESS_PROPS = ['building_number', 'street', 'town', 'postcode']

const toOnfidoName = name => {
  const first_name = name.firstName || name.givenName
  const last_name = name.lastName || name.surname
  if (first_name && last_name) {
    return { first_name, last_name }
  }
}

const getAddress = (form) => {
  const countryCode = getCountryCode(form.country)
  if (!countryCode) {
    debug(`ignoring address with country "${form.country.title}", don't know country 3-letter country code`)
    return
  }

  const address:OnfidoAddress = {
    country: countryCode
  }

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

const getDateOfBirth = (form) => {
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

export default {
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
