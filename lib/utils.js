"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const crypto = require("crypto");
const _ = require("lodash");
const constants_1 = require("@tradle/constants");
const buildResource = require("@tradle/build-resource");
const validateResource = require("@tradle/validate-resource");
const onfido_models_1 = require("./onfido-models");
const models_1 = require("./models");
const constants_2 = require("./constants");
const Extractor = require("./extractor");
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const APPLICANT_PROPERTY_SETS = ['name', 'dob', 'address'];
const APPLICANT_PROPERTY_SETS_MIN = ['name', 'dob'];
const createFilterForType = query => ({ type }) => type === query;
const { sanitize } = validateResource.utils;
exports.sanitize = sanitize;
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
exports.getFormsToCreateApplicant = ({ forms, reports }) => {
    const parsed = forms
        .slice()
        .sort(sortDescendingByDate)
        .map(exports.parseStub);
    const propSets = reports.includes('identity') ? APPLICANT_PROPERTY_SETS : APPLICANT_PROPERTY_SETS_MIN;
    const required = propSets.map(field => {
        return parsed.find(({ type }) => Extractor.canExtract(field, type));
    });
    if (required.every(result => result)) {
        return _.uniqBy(required, ({ type }) => type);
    }
};
exports.isApplicantInfoForm = type => Extractor.hasForm(type);
exports.getApplicantProps = (forms) => {
    const { name, address, dob } = APPLICANT_PROPERTY_SETS.reduce((fields, field) => {
        fields[field] = exports.find(forms, form => {
            return Extractor.extract(field, form[constants_1.TYPE], form);
        });
        return fields;
    }, {});
    const props = {};
    if (name)
        Object.assign(props, name);
    if (dob)
        props.dob = dob;
    if (address)
        props.addresses = [address];
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
const sortDescendingByDate = (a, b) => {
    return b.time - a.time;
};
exports.find = (arr, filter) => {
    let result;
    arr.some((el, i) => {
        const candidate = filter(el, i);
        if (candidate) {
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
exports.ensureNoPendingCheck = state => {
    if (state.checkStatus && exports.getEnumValueId(state.checkStatus) === 'inprogress') {
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
    const aspect = report.name === 'facial_similarity' ? 'facial similarity' : 'authenticity';
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
exports.batchify = (arr, batchSize) => {
    const batches = [];
    while (arr.length) {
        batches.push(arr.slice(0, batchSize));
        arr = arr.slice(batchSize);
    }
    return batches;
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
    const { reports } = opts;
    if (!(reports && Array.isArray(reports) && reports.length)) {
        throw new Error('expected "reports" array in product options');
    }
    const bad = reports.find(report => !constants_2.REPORTS.includes(report));
    if (bad) {
        throw new Error(`report "${bad}" is invalid. Supported reports are: ${constants_2.REPORTS.join(', ')}`);
    }
};
exports.getFormStubs = application => (application.forms || [])
    .map(appSub => exports.parseStub(appSub.submission));
//# sourceMappingURL=utils.js.map