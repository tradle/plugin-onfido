"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const _ = require("lodash");
const Debug = require("debug");
const constants_1 = require("@tradle/constants");
const onfido_tradle_mapping_1 = __importDefault(require("./onfido-tradle-mapping"));
const constants_2 = require("./constants");
const utils_1 = require("./utils");
const packageName = require('../package.json').name;
const debug = Debug(packageName + ':extractor');
const ADDRESS_PROPS = ['building_number', 'street', 'town', 'postcode', 'country'];
const NAME_PROPS = ['first_name', 'last_name'];
const createSubsetGetter = subset => form => {
    let mapping = onfido_tradle_mapping_1.default[form[constants_1.TYPE]];
    if (!mapping)
        return;
    mapping = _.pick(mapping, subset);
    let mapped;
    try {
        mapped = _.transform(mapping, (result, pMapping, onfidoProp) => {
            const { tradle, transform = _.identity } = pMapping;
            const val = transform(form[tradle]);
            if (val != null)
                result[onfidoProp] = val;
        }, {});
    }
    catch (err) {
        debug(`failed to extract props: ${subset.join(', ')}`, err);
    }
    return _.size(mapped) ? mapped : undefined;
};
const toOnfidoName = createSubsetGetter(NAME_PROPS);
const getAddress = createSubsetGetter(ADDRESS_PROPS);
const getDateOfBirth = (form) => {
    let date;
    const type = form[constants_1.TYPE];
    if (type === constants_2.APPLICANT || type === constants_2.PG_PERSONAL_DETAILS || type === constants_2.PHOTO_ID) {
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
exports.byProp = {
    name: {
        [constants_2.NAME]: toOnfidoName,
        [constants_2.APPLICANT]: toOnfidoName,
        [constants_2.PG_PERSONAL_DETAILS]: toOnfidoName,
        [constants_2.PHOTO_ID]: toOnfidoName
    },
    address: {
        [constants_2.APPLICANT]: getAddress,
        [constants_2.ADDRESS]: getAddress
    },
    dob: {
        [constants_2.APPLICANT]: getDateOfBirth,
        [constants_2.PG_PERSONAL_DETAILS]: getDateOfBirth,
        [constants_2.PHOTO_ID]: getDateOfBirth
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