import { models } from '@tradle/models'
import validateResource from '@tradle/validate-resource'
import {
  ADDRESS,
  APPLICANT,
  SELFIE,
  PHOTO_ID,
  EMAIL_ADDRESS,
  NAME,
  PG_PERSONAL_DETAILS
} from './constants'

const { parseEnumValue } = validateResource.utils
const countryModel = models['tradle.Country']

const getCountryCCA3Code = value => parseEnumValue({ model: countryModel, value }).cca3

const pgPersonalDetailsMapping = {
  first_name: {
    tradle: 'firstName',
  },
  last_name: {
    tradle: 'lastName'
  },
  dob: {
    tradle: 'dateOfBirth'
  }
}

const nameFormMapping = {
  first_name: {
    tradle: 'firstName'
  },
  last_name: {
    tradle: 'lastName'
  }
}

const applicantFormMapping = {
  building_number: {
    tradle: 'buildingNumber'
  },
  flat_number: {
    tradle: 'flatNumber'
  },
  street: {
    tradle: 'street'
  },
  sub_street: {
    tradle: 'subStreet'
  },
  town: {
    tradle: 'town'
  },
  postcode: {
    tradle: 'postcode'
  },
  first_name: {
    tradle: 'givenName'
  },
  last_name: {
    tradle: 'surname'
  },
  dob: {
    tradle: 'dateOfBirth'
  },
  country: {
    tradle: 'country',
    transform: getCountryCCA3Code
  }
}

const selfieFormProps = {
  face_detection: {
    tradle: 'selfie'
  }
}

const photoIdFormProps = {
  document: {
    tradle: 'scan'
  },
  first_name: {
    tradle: 'firstName'
  },
  last_name: {
    tradle: 'lastName'
  },
  dob: {
    tradle: 'dateOfBirth'
  },
}

const emailFormProps = {
  email: {
    tradle: 'email'
  }
}

const byForm = {
  [NAME]: nameFormMapping,
  [APPLICANT]: applicantFormMapping,
  [SELFIE]: selfieFormProps,
  [PHOTO_ID]: photoIdFormProps,
  [EMAIL_ADDRESS]: emailFormProps,
  [PG_PERSONAL_DETAILS]: pgPersonalDetailsMapping
}

export default byForm
