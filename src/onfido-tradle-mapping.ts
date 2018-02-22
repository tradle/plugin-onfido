import {
  ADDRESS,
  APPLICANT,
  SELFIE,
  PHOTO_ID,
  EMAIL_ADDRESS,
  NAME
} from './constants'

const getCountryCode = (country) => {
  switch (country.title.trim().toLowerCase()) {
    case 'united kingdom':
      return 'GBR'
    case 'new zealand':
      return 'NZL'
  }
}

const countryTransform = country => {
  const countryCode = getCountryCode(country)
  if (!countryCode) {
    throw new Error(`don't know 3-letter code for "${country.title}"`)
  }

  return countryCode
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
    transform: countryTransform
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
  }
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
  [EMAIL_ADDRESS]: emailFormProps
}

export default byForm
