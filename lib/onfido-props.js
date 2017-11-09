"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const constants_1 = require("./constants");
exports.default = {
    building_number: {
        form: constants_1.APPLICANT,
        tradle: 'buildingNumber',
        error: 'Please correct your building number'
    },
    flat_number: {
        form: constants_1.APPLICANT,
        tradle: 'flatNumber',
        error: 'Please correct your flat number'
    },
    street: {
        form: constants_1.APPLICANT,
        tradle: 'street',
        error: 'Please correct your street'
    },
    sub_street: {
        form: constants_1.APPLICANT,
        tradle: 'subStreet',
        error: 'Please correct your substreet'
    },
    town: {
        form: constants_1.APPLICANT,
        tradle: 'town',
        error: 'Please correct your town'
    },
    postcode: {
        form: constants_1.APPLICANT,
        tradle: 'postcode',
        error: 'Please correct your postcode'
    },
    first_name: {
        form: constants_1.APPLICANT,
        tradle: 'givenName',
        error: 'Please correct your given name(s)'
    },
    last_name: {
        form: constants_1.APPLICANT,
        tradle: 'surname',
        error: 'Please correct your surname'
    },
    dob: {
        form: constants_1.APPLICANT,
        tradle: 'dateOfBirth',
        error: 'Please correct your date of birth'
    },
    face_detection: {
        form: constants_1.SELFIE,
        tradle: 'selfie',
        error: 'We were unable to process your selfie. Please take another, centering your face in the frame.'
    },
    document: {
        form: constants_1.PHOTO_ID,
        tradle: 'scan',
        error: 'Please upload a clearer image of your document'
    },
    email: {
        form: constants_1.EMAIL_ADDRESS,
        tradle: 'email',
        error: 'Please correct your email'
    }
};
//# sourceMappingURL=onfido-props.js.map