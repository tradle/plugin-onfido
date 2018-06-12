"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const models_1 = require("@tradle/models");
const validate_resource_1 = __importDefault(require("@tradle/validate-resource"));
const constants_1 = require("./constants");
const { parseEnumValue } = validate_resource_1.default.utils;
const countryModel = models_1.models['tradle.Country'];
const getCountryCCA3Code = value => parseEnumValue({ model: countryModel, value }).cca3;
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
};
const nameFormMapping = {
    first_name: {
        tradle: 'firstName'
    },
    last_name: {
        tradle: 'lastName'
    }
};
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
};
const selfieFormProps = {
    face_detection: {
        tradle: 'selfie'
    }
};
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
};
const emailFormProps = {
    email: {
        tradle: 'email'
    }
};
const byForm = {
    [constants_1.NAME]: nameFormMapping,
    [constants_1.APPLICANT]: applicantFormMapping,
    [constants_1.SELFIE]: selfieFormProps,
    [constants_1.PHOTO_ID]: photoIdFormProps,
    [constants_1.EMAIL_ADDRESS]: emailFormProps,
    [constants_1.PG_PERSONAL_DETAILS]: pgPersonalDetailsMapping
};
exports.default = byForm;
//# sourceMappingURL=onfido-tradle-mapping.js.map