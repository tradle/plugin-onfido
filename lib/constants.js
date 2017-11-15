"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const onfido_models_1 = require("./onfido-models");
const IPROOV_SELFIE = 'tradle.IProovSelfie';
exports.IPROOV_SELFIE = IPROOV_SELFIE;
const SELFIE = 'tradle.Selfie';
exports.SELFIE = SELFIE;
const PHOTO_ID = 'tradle.PhotoID';
exports.PHOTO_ID = PHOTO_ID;
const ADDRESS = 'tradle.OnfidoAddress';
exports.ADDRESS = ADDRESS;
const APPLICANT = 'tradle.OnfidoApplicant';
exports.APPLICANT = APPLICANT;
const EMAIL_ADDRESS = 'tradle.EmailAddress';
exports.EMAIL_ADDRESS = EMAIL_ADDRESS;
const NAME = 'tradle.Name';
exports.NAME = NAME;
const VERIFICATION = 'tradle.Verification';
exports.VERIFICATION = VERIFICATION;
const APPLICATION = 'tradle.Application';
exports.APPLICATION = APPLICATION;
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
//# sourceMappingURL=constants.js.map