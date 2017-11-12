"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const crypto = require("crypto");
const constants_1 = require("@tradle/constants");
const buildResource = require("@tradle/build-resource");
const validateResource = require("@tradle/validate-resource");
const onfido_models_1 = require("./onfido-models");
const models_1 = require("./models");
const constants_2 = require("./constants");
const extractor_1 = require("./extractor");
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const APPLICANT_PROPERTY_SETS = ['name', 'address', 'dob'];
const createFilterForType = query => ({ type }) => type === query;
exports.getLatestFormByType = (application, type) => {
    return exports.getLatestForm(application, createFilterForType(type));
};
exports.getLatestForm = (application, filter) => {
    let result;
    application.forms.slice().sort(sortDescendingByDate).some(stub => {
        const parsed = exports.parseStub(stub);
        if (filter(parsed)) {
            result = parsed;
            return true;
        }
    });
    return result;
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
    const [match, checkId, reportId] = url.match(/\/checks\/([a-zA-Z0-9-_]+)\/reports\/([a-zA-Z0-9-_]+)/);
    return { checkId, reportId };
};
exports.parseCheckURL = url => {
    url = url.href || url;
    const [match, applicantId, checkId] = url.match(/\/applicants\/([a-zA-Z0-9-_]+)\/checks\/([a-zA-Z0-9-_]+)/);
    return { applicantId, checkId };
};
exports.getOnfidoCheckIdKey = checkId => {
    return `onfido_check_${checkId}`;
};
exports.haveFormsToCreateApplicant = application => {
    return !!exports.getFormsToCreateApplicant(application);
};
exports.getFormsToCreateApplicant = application => {
    const parsed = application.forms.slice().sort(sortDescendingByDate).map(stub => exports.parseStub(stub));
    const required = APPLICANT_PROPERTY_SETS.map(propertySet => {
        return parsed.find(({ type }) => extractor_1.default[propertySet][type]);
    });
    if (required.every(result => result)) {
        return exports.unique(required);
    }
};
exports.unique = arr => {
    const map = new Map();
    const uniq = [];
    for (const item of arr) {
        if (!map.has(item)) {
            map.set(item, true);
            uniq.push(item);
        }
    }
    return uniq;
};
exports.isApplicantInfoForm = type => {
    return Object.keys(extractor_1.default).find(propertySet => extractor_1.default[propertySet][type]);
};
exports.getApplicantProps = (forms) => {
    const { name, address, dob } = APPLICANT_PROPERTY_SETS.reduce((result, propertySet) => {
        result[propertySet] = exports.find(forms, form => {
            const extractor = extractor_1.default[propertySet][form[constants_1.TYPE]];
            if (extractor)
                return extractor(form);
        });
        return result;
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
        const match = current.reportsResults.find(r => r.id === report.id);
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
            name: 'onfido',
            provider: {
                id: 'tradle.Organization_57f54fd7a5dd777a541ca994f3155aaecd656bc05ac52e6163a2311d2d4b8b87_57f54fd7a5dd777a541ca994f3155aaecd656bc05ac52e6163a2311d2d4b8b87',
                title: 'Onfido'
            }
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
//# sourceMappingURL=utils.js.map