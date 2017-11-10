const IPROOV_SELFIE = 'tradle.IProovSelfie'
const SELFIE = 'tradle.Selfie'
const PHOTO_ID = 'tradle.PhotoID'
const ADDRESS = 'tradle.OnfidoAddress'
const APPLICANT = 'tradle.OnfidoApplicant'
const EMAIL_ADDRESS = 'tradle.EmailAddress'
const NAME = 'tradle.Name'
const VERIFICATION = 'tradle.Verification'
const APPLICATION = 'tradle.Application'
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

export {
  IPROOV_SELFIE,
  SELFIE,
  PHOTO_ID,
  ADDRESS,
  APPLICANT,
  EMAIL_ADDRESS,
  NAME,
  VERIFICATION,
  APPLICATION,
  DEFAULT_WEBHOOK_KEY,
  ONFIDO_WEBHOOK_EVENTS,
  DEFAULT_WEBHOOK_EVENTS
}
