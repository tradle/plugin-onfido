"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const onfido_models_1 = __importDefault(require("./onfido-models"));
const IPROOV_SELFIE = 'tradle.IProovSelfie';
exports.IPROOV_SELFIE = IPROOV_SELFIE;
const SELFIE = 'tradle.Selfie';
exports.SELFIE = SELFIE;
const PHOTO_ID = 'tradle.PhotoID';
exports.PHOTO_ID = PHOTO_ID;
const ADDRESS = 'tradle.onfido.Address';
exports.ADDRESS = ADDRESS;
const APPLICANT = 'tradle.onfido.Applicant';
exports.APPLICANT = APPLICANT;
const EMAIL_ADDRESS = 'tradle.EmailAddress';
exports.EMAIL_ADDRESS = EMAIL_ADDRESS;
const NAME = 'tradle.Name';
exports.NAME = NAME;
const VERIFICATION = 'tradle.Verification';
exports.VERIFICATION = VERIFICATION;
const APPLICATION = 'tradle.Application';
exports.APPLICATION = APPLICATION;
const PG_PERSONAL_DETAILS = 'tradle.pg.PersonalDetails';
exports.PG_PERSONAL_DETAILS = PG_PERSONAL_DETAILS;
const DEFAULT_WEBHOOK_KEY = 'onfido_webhook';
exports.DEFAULT_WEBHOOK_KEY = DEFAULT_WEBHOOK_KEY;
const ONFIDO_WEBHOOK_EVENTS = [
    'report.completed',
    'report.withdrawn',
    'check.completed',
    'check.started',
    'check.form_opened',
    'check.form_completed'
];
exports.ONFIDO_WEBHOOK_EVENTS = ONFIDO_WEBHOOK_EVENTS;
const DEFAULT_WEBHOOK_EVENTS = [
    'report.completed',
    'report.withdrawn',
    'check.completed'
];
exports.DEFAULT_WEBHOOK_EVENTS = DEFAULT_WEBHOOK_EVENTS;
const REPORTS = onfido_models_1.default.reportType.enum.map(({ id }) => id);
exports.REPORTS = REPORTS;
const DEFAULT_REPORTS = REPORTS.slice();
exports.DEFAULT_REPORTS = DEFAULT_REPORTS;
const ADDRESS_PROPS = ['building_number', 'street', 'town', 'postcode', 'country'];
const NAME_PROPS = ['first_name', 'last_name'];
const DOB_PROPS = ['dob'];
const PROPERTY_SETS = {
    name: NAME_PROPS,
    dob: DOB_PROPS,
    address: ADDRESS_PROPS
};
exports.PROPERTY_SETS = PROPERTY_SETS;
//# sourceMappingURL=constants.js.map