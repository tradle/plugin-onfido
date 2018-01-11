"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const _ = require("lodash");
const Debug = require("debug");
const constants_1 = require("@tradle/constants");
const onfido_props_1 = require("./onfido-props");
const constants_2 = require("./constants");
const utils_1 = require("./utils");
const packageName = require('../package.json').name;
const debug = Debug(packageName + ':extractor');
const ADDRESS_PROPS = ['building_number', 'street', 'town', 'postcode'];
const toOnfidoName = name => {
    const first_name = name.firstName || name.givenName;
    const last_name = name.lastName || name.surname;
    if (first_name && last_name) {
        return { first_name, last_name };
    }
};
const getAddress = (form) => {
    const countryCode = getCountryCode(form.country);
    if (!countryCode) {
        debug(`ignoring address with country "${form.country.title}", don't know country 3-letter country code`);
        return;
    }
    const address = {
        country: countryCode
    };
    ADDRESS_PROPS.forEach(prop => {
        const propInfo = onfido_props_1.default[prop];
        if (typeof propInfo !== 'undefined') {
            address[prop] = form[propInfo.tradle];
        }
    });
    if (form.subStreet)
        address.sub_street = form.subStreet;
    if (form.flatNumber)
        address.flat_number = form.flatNumber;
    return address;
};
const getDateOfBirth = (form) => {
    let date;
    if (form[constants_1.TYPE] === constants_2.APPLICANT) {
        date = form.dateOfBirth;
    }
    // else if (form[TYPE] === PHOTO_ID) {
    //   if (!form.scanJson) return
    //   const { personal } = form.scanJson
    //   if (!personal) return
    //   date = new Date(personal.dateOfBirth)
    // }
    if (date) {
        return utils_1.normalizeDate(date);
    }
};
const getCountryCode = (country) => {
    switch (country.title.trim().toLowerCase()) {
        case 'united kingdom':
            return 'GBR';
        case 'new zealand':
            return 'NZL';
    }
};
exports.byProp = {
    name: {
        [constants_2.NAME]: toOnfidoName,
        [constants_2.APPLICANT]: toOnfidoName
    },
    address: {
        [constants_2.APPLICANT]: getAddress,
        [constants_2.ADDRESS]: getAddress
    },
    dob: {
        [constants_2.APPLICANT]: getDateOfBirth
    }
};
exports.byForm = _.transform(exports.byProp, (result, formToExtractor, key) => {
    _.each(formToExtractor, (extractor, formType) => {
        _.set(result, [formType, key], extractor);
    });
}, {});
exports.getExtractor = (field, fromFormType) => {
    return exports.byProp[field][fromFormType];
};
exports.canExtract = (field, fromFormType) => {
    return !!exports.getExtractor(field, fromFormType);
};
exports.extract = (field, fromFormType, form) => {
    const fn = exports.getExtractor(field, fromFormType);
    return fn && fn(form);
};
exports.hasField = (field) => field in exports.byProp;
exports.hasForm = (formType) => formType in exports.byForm;
//# sourceMappingURL=extractor.js.map