"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const crypto = require("crypto");
const _ = require("lodash");
const constants_1 = require("@tradle/constants");
const buildResource = require("@tradle/build-resource");
const validateResource = require("@tradle/validate-resource");
const validateModel = require("@tradle/validate-model");
const onfido_models_1 = __importDefault(require("./onfido-models"));
const models_1 = __importDefault(require("./models"));
const constants_2 = require("./constants");
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const APPLICANT_PROPERTY_SETS = ['name', 'dob', 'address'];
const APPLICANT_PROPERTY_SETS_MIN = ['name', 'dob'];
const createFilterForType = query => ({ type }) => type === query;
const { sanitize, parseEnumValue } = validateResource.utils;
exports.sanitize = sanitize;
const { getRef } = validateModel.utils;
const ONE_OR_MORE = 'One or more of the following checks';
exports.getLatestFormByType = (application, type) => {
    return exports.getLatestForm(application, createFilterForType(type));
};
exports.getLatestForm = (application, filter) => {
    return exports.getFormStubs(application).find(parsed => filter(parsed));
};
exports.parseStub = validateResource.utils.parseStub;
exports.getPhotoID = (application) => {
    return exports.getLatestForm(application, ({ type }) => type === constants_2.PHOTO_ID);
};
exports.getSelfie = (application) => {
    return exports.getLatestForm(application, ({ type }) => type === constants_2.SELFIE);
};
exports.firstProp = obj => {
    for (let k in obj) {
        return k;
    }
};
exports.parseReportURL = url => {
    url = url.href || url;
    const [match, checkId, reportId] = url.match(/(?:\/checks\/([^/]+))?\/reports\/([^/]+)/);
    return { checkId, reportId };
};
exports.parseCheckURL = url => {
    url = url.href || url;
    const [match, applicantId, checkId] = url.match(/(?:\/applicants\/([^/]+))?\/checks\/([^/]+)/);
    return { applicantId, checkId };
};
exports.getOnfidoCheckIdKey = checkId => {
    return `onfido_check_${checkId}`;
};
exports.canExtractFromFormType = ({ formType, fieldName, propertyMap }) => {
    const sources = propertyMap[fieldName];
    if (sources) {
        return sources.some(({ source }) => source === formType);
    }
};
exports.extractFieldFromForm = ({ models, form, fieldName, propertyMap }) => {
    let sources = propertyMap[fieldName];
    if (!sources)
        return;
    sources = sources.filter(({ source, property }) => {
        if (source !== form[constants_1.TYPE])
            return;
        const topProp = typeof property === 'string' ? property : property[0];
        return form[topProp] != null;
    });
    return exports.find(sources, ({ property }) => {
        if (typeof property === 'string' || property.length === 1)
            return _.get(form, property);
        const model = models[form[constants_1.TYPE]];
        const [propName, enumPropName] = property;
        const propInfo = model.properties[propName];
        const ref = getRef(propInfo);
        if (ref) {
            const propModel = models[ref];
            if (propModel.subClassOf === 'tradle.Enum') {
                const enumVal = parseEnumValue({ model: propModel, value: form[propName] });
                return enumVal[enumPropName];
            }
        }
        return _.get(form, property);
    });
};
exports.getFormsToCreateApplicant = ({ models, forms, reports, propertyMap }) => {
    const parsed = forms
        .slice()
        // .sort(sortDescendingByDate)
        .map(exports.parseStub);
    const propSets = reports.includes('identity') ? APPLICANT_PROPERTY_SETS : APPLICANT_PROPERTY_SETS_MIN;
    const required = _.flatMap(propSets, setName => {
        const fields = constants_2.PROPERTY_SETS[setName];
        const sources = fields.map(fieldName => {
            return parsed.find(({ type }) => exports.canExtractFromFormType({ formType: type, fieldName, propertyMap }));
        });
        if (sources.every(_.identity))
            return sources;
    });
    if (required.every(result => result)) {
        return _.uniqBy(required, ({ type }) => type);
    }
};
const hasRequiredAddressProps = props => {
    const ok = constants_2.REQUIRED_ADDRESS_PROPS.every(prop => props[prop] != null);
    if (ok) {
        if (props.country === 'USA')
            return !!props.state;
        return true;
    }
    return false;
};
exports.getApplicantProps = ({ models, forms, propertyMap }) => {
    const sets = APPLICANT_PROPERTY_SETS.reduce((sets, setName) => {
        sets[setName] = constants_2.PROPERTY_SETS[setName].reduce((fields, fieldName) => {
            const val = exports.find(forms, form => exports.extractFieldFromForm({ models, fieldName, form, propertyMap }));
            if (val != null) {
                fields[fieldName] = val;
            }
            return fields;
        }, {});
        return sets;
    }, {});
    const props = {};
    if (sets.name)
        Object.assign(props, sets.name);
    if (sets.dob)
        props.dob = exports.normalizeDate(sets.dob.dob);
    if (sets.address && hasRequiredAddressProps(sets.address)) {
        props.addresses = [sets.address];
    }
    return props;
};
exports.normalizeDate = (date) => {
    if (typeof date === 'string') {
        if (ISO_DATE.test(date)) {
            return date;
        }
    }
    date = new Date(date); // danger!
    return exports.toYYYY_MM_DD_UTC(date, '-');
};
// courtesy of http://stackoverflow.com/questions/3066586/get-string-in-yyyymmdd-format-from-js-date-object
exports.toYYYY_MM_DD_UTC = (date, separator) => {
    const mm = date.getUTCMonth() + 1; // getUTCMonth() is zero-based
    const dd = date.getUTCDate();
    return [
        date.getUTCFullYear(),
        (mm > 9 ? '' : '0') + mm,
        (dd > 9 ? '' : '0') + dd
    ].join(separator || '');
};
// const sortDescendingByDate = (a, b) => {
//   return b._time - a._time
// }
exports.find = (arr, filter) => {
    let result;
    arr.some((el, i) => {
        const candidate = filter(el, i);
        if (candidate != null) {
            return result = candidate;
        }
    });
    return result;
};
exports.equalish = (a, b) => {
    return exports.stringifyAndNormalize(a) === exports.stringifyAndNormalize(b);
};
exports.stringifyAndNormalize = (val) => {
    return String(val).trim().toLowerCase();
};
const mimeTypeToExt = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'application/pdf': 'pdf',
    'image/gif': 'gif',
};
exports.getExtension = (mimeType) => {
    return mimeTypeToExt[mimeType] || mimeType.split('/')[1];
};
exports.digest = (data) => {
    return crypto.createHash('sha256').update(data).digest('hex').slice(0, 7);
};
exports.hasTwoSides = (onfidoType) => {
    return onfidoType !== 'passport';
};
exports.pickNonNull = obj => {
    const defined = {};
    for (let key in obj) {
        let val = obj[key];
        if (val != null) {
            defined[key] = val;
        }
    }
    return defined;
};
exports.isVirginCheck = check => !check.onfidoStatus;
exports.isPendingCheck = check => {
    return check.onfidoStatus && exports.getEnumValueId(check.onfidoStatus) === 'inprogress';
};
exports.ensureNoPendingCheck = check => {
    if (exports.isPendingCheck(check)) {
        throw new Error('cannot upload selfie until pending check is resolved');
    }
};
// export const setProcessStatus = (state, value) => {
//   state.status = buildResource.enumValue({
//     model: onfidoModels.processStatus,
//     value
//   })
// }
exports.getEnumValueId = (value) => {
    const type = (value.id || value).split('_')[0];
    const model = onfido_models_1.default.all[type];
    const parsed = validateResource.utils.parseEnumValue({ model, value });
    return parsed.id;
};
exports.getCompletedReports = ({ current, update }) => {
    if (!current)
        return update.reports.filter(exports.isComplete);
    return update.reports.filter(report => {
        if (!exports.isComplete(report))
            return;
        const match = current.reports.find(r => r.id === report.id);
        if (match)
            return !exports.isComplete(match);
    });
};
exports.createOnfidoVerification = ({ applicant, form, report }) => {
    const aspect = report.name === 'facial_similarity' ? 'facial similarity' : 'document authenticity';
    const method = {
        [constants_1.TYPE]: 'tradle.APIBasedVerificationMethod',
        api: {
            [constants_1.TYPE]: 'tradle.API',
            name: 'onfido'
        },
        reference: [{ queryId: 'report:' + report.id }],
        aspect,
        rawData: report
    };
    const score = report && report.properties && report.properties.score;
    if (typeof score === 'number') {
        method.confidence = score;
    }
    return buildResource({
        models: models_1.default,
        model: constants_2.VERIFICATION
    })
        .set({
        document: form,
        method
        // documentOwner: applicant
    })
        .toJSON();
};
exports.isComplete = (onfidoObject) => {
    return (onfidoObject.status || '').indexOf('complete') !== -1;
};
exports.addLinks = (resource) => {
    buildResource.setVirtual(resource, {
        _link: buildResource.link(resource),
        _permalink: buildResource.permalink(resource)
    });
};
exports.stubFromParsedStub = stub => {
    const { type, link, permalink, title } = exports.parseStub(stub);
    const fixed = {
        [constants_1.TYPE]: type,
        _link: link,
        _permalink: permalink
    };
    if (title)
        fixed._displayName = title;
    return fixed;
};
exports.validateProductOptions = (opts) => {
    const { reports, propertyMap } = opts;
    if (!(reports && Array.isArray(reports) && reports.length)) {
        throw new Error('expected "reports" array in product options');
    }
    const bad = reports.find(report => !constants_2.REPORTS.includes(report));
    if (bad) {
        throw new Error(`report "${bad}" is invalid. Supported reports are: ${constants_2.REPORTS.join(', ')}`);
    }
    // if (!propertyMap) throw new Error('expected "propertyMap"')
};
exports.getFormStubs = application => (application.forms || [])
    .map(appSub => exports.parseStub(appSub.submission));
exports.isAddressRequired = (reports) => reports.includes('identity');
exports.getStatus = (onfidoResult) => {
    if (onfidoResult === 'clear')
        return 'pass';
    if (onfidoResult === 'consider')
        return 'fail';
    return 'error';
};
exports.getMessageForAspects = (aspects, status) => {
    if (status)
        status = status.toLowerCase();
    const checkPhrase = ONE_OR_MORE;
    if (status === 'pass') {
        return `Check(s) passed: ${aspects}`;
    }
    if (status === 'fail') {
        return `${checkPhrase} failed: ${aspects}`;
    }
    if (status === 'error') {
        return `${checkPhrase} hit an error: ${aspects}`;
    }
    return `${checkPhrase} pending: ${aspects}`;
};
//# sourceMappingURL=utils.js.map