import {
  ADDRESS,
  APPLICANT,
  SELFIE,
  PHOTO_ID,
  EMAIL_ADDRESS
} from './constants'

export default {
  building_number: {
    form: APPLICANT,
    tradle: 'buildingNumber',
    error: 'Please correct your building number'
  },
  flat_number: {
    form: APPLICANT,
    tradle: 'flatNumber',
    error: 'Please correct your flat number'
  },
  street: {
    form: APPLICANT,
    tradle: 'street',
    error: 'Please correct your street'
  },
  sub_street: {
    form: APPLICANT,
    tradle: 'subStreet',
    error: 'Please correct your substreet'
  },
  town: {
    form: APPLICANT,
    tradle: 'town',
    error: 'Please correct your town'
  },
  postcode: {
    form: APPLICANT,
    tradle: 'postcode',
    error: 'Please correct your postcode'
  },
  first_name: {
    form: APPLICANT,
    tradle: 'givenName',
    error: 'Please correct your given name(s)'
  },
  last_name: {
    form: APPLICANT,
    tradle: 'surname',
    error: 'Please correct your surname'
  },
  dob: {
    form: APPLICANT,
    tradle: 'dateOfBirth',
    error: 'Please correct your date of birth'
  },
  face_detection: {
    form: SELFIE,
    tradle: 'selfie',
    error: 'We were unable to process your selfie. Please take another, centering your face in the frame.'
  },
  document: {
    form: PHOTO_ID,
    tradle: 'scan',
    error: 'Please upload a clearer image of your document'
  },
  email: {
    form: EMAIL_ADDRESS,
    tradle: 'email',
    error: 'Please correct your email'
  }
}
