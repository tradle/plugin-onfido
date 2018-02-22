import onfidoModels from './onfido-models'

const IPROOV_SELFIE = 'tradle.IProovSelfie'
const SELFIE = 'tradle.Selfie'
const PHOTO_ID = 'tradle.PhotoID'
const ADDRESS = 'tradle.onfido.Address'
const APPLICANT = 'tradle.onfido.Applicant'
const EMAIL_ADDRESS = 'tradle.EmailAddress'
const NAME = 'tradle.Name'
const VERIFICATION = 'tradle.Verification'
const APPLICATION = 'tradle.Application'
const PG_PERSONAL_DETAILS = 'tradle.pg.PersonalDetails'
const DEFAULT_WEBHOOK_KEY = 'onfido_webhook'
const ONFIDO_WEBHOOK_EVENTS = [
  'report.completed',
  'report.withdrawn',
  'check.completed',
  'check.started',
  'check.form_opened',
  'check.form_completed'
]

const DEFAULT_WEBHOOK_EVENTS = [
  'report.completed',
  'report.withdrawn',
  'check.completed'
]

const REPORTS = onfidoModels.reportType.enum.map(({ id }) => id)
const DEFAULT_REPORTS = REPORTS.slice()

export {
  // models
  IPROOV_SELFIE,
  SELFIE,
  PHOTO_ID,
  ADDRESS,
  APPLICANT,
  EMAIL_ADDRESS,
  NAME,
  VERIFICATION,
  APPLICATION,
  PG_PERSONAL_DETAILS,

  // others
  DEFAULT_WEBHOOK_KEY,
  ONFIDO_WEBHOOK_EVENTS,
  DEFAULT_WEBHOOK_EVENTS,
  REPORTS,
  DEFAULT_REPORTS
}
