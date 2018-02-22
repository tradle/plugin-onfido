"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const constants_1 = require("./constants");
const getCountryCode = (country) => {
    switch (country.title.trim().toLowerCase()) {
        case 'united kingdom':
            return 'GBR';
        case 'new zealand':
            return 'NZL';
    }
};
const countryTransform = country => {
    const countryCode = getCountryCode(country);
    if (!countryCode) {
        throw new Error(`don't know 3-letter code for "${country.title}"`);
    }
    return countryCode;
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
        transform: countryTransform
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
    }
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
    [constants_1.EMAIL_ADDRESS]: emailFormProps
};
exports.default = byForm;
//# sourceMappingURL=onfido-tradle-mapping.js.map