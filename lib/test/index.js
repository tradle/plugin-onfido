"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const source_map_support_1 = require("source-map-support");
source_map_support_1.install();
const test = require("tape");
const sinon = require("sinon");
const constants_1 = require("@tradle/constants");
const buildResource = require("@tradle/build-resource");
const fakeResource = require("@tradle/build-resource/fake");
const mock_1 = require("./mock");
const fixtures_1 = require("./fixtures");
const models_1 = require("./models");
const utils_1 = require("../utils");
const forms = fixtures_1.default.tradle;
const formsByType = {};
for (let name in forms) {
    formsByType[forms[name][constants_1.TYPE]] = forms[name];
}
const formStubs = {};
for (let name in forms) {
    formStubs[name] = toStub(forms[name]);
}
test.only('create applicant', loudAsync((t) => __awaiter(this, void 0, void 0, function* () {
    // t.plan(5)
    const onfido = mock_1.default.client();
    let i = 0;
    const applicantInfo = newApplicantInfo();
    const application = {
        applicant: applicantInfo.stub,
        forms: [
            formStubs.name
        ]
    };
    const getResourceStub = sinon.stub(onfido.bot.db, 'get').callsFake((props) => __awaiter(this, void 0, void 0, function* () {
        const { type } = utils_1.getLatestFormByType(application, props[constants_1.TYPE]);
        return formsByType[type];
    }));
    const uploadLivePhotoStub = sinon.stub(onfido.onfidoAPI.applicants, 'uploadLivePhoto')
        .callsFake((id, photo) => __awaiter(this, void 0, void 0, function* () {
        t.equal(id, '0cc317bc-00a5-4e4b-8085-4485fceab85a');
        t.same(photo, {
            file: new Buffer('fdcdfab635b7145a806c8382a60f303e58498b0f7f74a7784c504fe58274fee2', 'hex'),
            filename: 'live-photo-51f77e2.jpg'
        });
        return;
    }));
    const uploadDocumentStub = sinon.stub(onfido.onfidoAPI.applicants, 'uploadDocument')
        .callsFake((id, doc) => __awaiter(this, void 0, void 0, function* () {
        t.equal(id, '0cc317bc-00a5-4e4b-8085-4485fceab85a');
        t.same(doc, {
            type: 'driving_licence',
            file: new Buffer('fdcdfab635b7145a806c8382a60f303e58498b0f7f74a7784c504fe58274fee2', 'hex'),
            filename: 'driving_licence-51f77e2.jpg'
        });
        return;
    }));
    const checkAddressStub = sinon.stub(onfido.apiUtils, 'checkAddress').callsFake(address => {
        return Promise.resolve({
            addresses: [address]
        });
    });
    const createApplicantStub = sinon.stub(onfido.onfidoAPI.applicants, 'create').callsFake(props => {
        t.same(props, {
            name: { first_name: 'Moog', last_name: 'Soni' },
            addresses: [{
                    country: 'GBR',
                    building_number: '96',
                    street: 'Thornfield Rd',
                    town: 'Middlesbrough',
                    postcode: 'TS5 5BY'
                }],
            dob: '1981-04-03'
        });
        return Promise.resolve(fixtures_1.default.applicants[0]);
    });
    const state = {};
    // not enough info
    t.equal(yield onfido.applicants.createOrUpdate({
        state,
        application
    }), false, 'do not create applicant');
    application.forms = [
        formStubs.name,
        formStubs.driving_license
    ];
    t.equal(yield onfido.applicants.createOrUpdate({
        state,
        application
    }), false, 'do not create applicant');
    application.forms = [
        formStubs.name,
        formStubs.passport
    ];
    t.equal(yield onfido.applicants.createOrUpdate({
        state,
        application
    }), false, 'do not create applicant');
    application.forms = [
        formStubs.applicant
    ];
    t.equal(yield onfido.applicants.createOrUpdate({
        state,
        application
    }), true);
    t.ok(state.onfidoApplicant);
    application.forms = [
        formStubs.applicant,
        formStubs.selfie,
        formStubs.driving_license
    ];
    t.equal(yield onfido.applicants.uploadSelfie({
        state,
        application,
        form: formStubs.selfie
    }), true);
    t.ok(state.selfie);
    t.equal(yield onfido.applicants.uploadPhotoID({
        state,
        application,
        form: forms.driving_license
    }), true);
    t.ok(state.photoID);
    getResourceStub.restore();
    checkAddressStub.restore();
    t.end();
})));
test('upload doc + selfie', loudAsync((t) => __awaiter(this, void 0, void 0, function* () {
    const result = 'clear';
    const applicant = fixtures_1.default.applicants[0];
    const applicantId = applicant.id;
    const check = adjustCheck(fixtures_1.default.checks[applicantId][1], { result: null, status: 'in_progress' });
    const document = fixtures_1.default.documents[applicantId][0];
    const pendingReport = check.reports[0];
    const completeCheck = adjustCheck(check, { status: 'complete', result });
    const onfido = mock_1.default.client();
    const applicantInfo = newApplicantInfo();
    const getResourceStub = sinon.stub(onfido.bot.db, 'get').callsFake(props => {
        if (i++ === 0) {
            t.equal(props._permalink, forms.applicant._permalink);
            return Promise.resolve(forms.applicant);
        }
        else {
            t.equal(props._permalink, buildResource.permalink(applicantInfo.identity));
            // return Promise.resolve(fixtures.applicants[0])
            return Promise.reject(new Error('no applicant found'));
        }
    });
    try {
        yield onfido.checks.create({ applicant: permalink, checkDocument: true });
        t.fail('should not be able to create check before uploading a document');
    }
    catch (err) {
        t.ok(/upload document/.test(err.message));
    }
    const license = fixtures_1.default.inputs.license;
    const photo = fixtures_1.default.inputs.selfie;
    yield onfido.uploadDocument({
        applicant: permalink,
        document: license
    });
    try {
        yield onfido.checks.create({ applicant: permalink, checkDocument: true, checkFace: true });
        t.fail('should not be able to create a face check before uploading a live photo');
    }
    catch (err) {
        t.ok(/upload a photo/.test(err.message));
    }
    yield onfido.uploadLivePhoto({
        applicant: permalink,
        photo: photo
    });
    yield onfido.checks.create({
        applicant: permalink,
        checkDocument: true,
        checkFace: true
    });
    const pending = yield onfido.checks.pending(permalink);
    t.same(pending, {
        applicant: permalink,
        applicantId: applicantId,
        onfido: check,
        latestDocument: license.link,
        latestPhoto: photo.link,
        checkDocument: true,
        checkFace: true,
        result: null,
        status: 'in_progress'
    });
    const webhookReq = new PassThrough();
    webhookReq.write(JSON.stringify({
        payload: {
            resource_type: 'check',
            action: 'check.completed',
            object: {
                id: check.id,
                status: 'completed',
                completed_at: new Date().toJSON(),
                href: check.href,
                reports: completeCheck.reports
            }
        }
    }));
    webhookReq.end();
    const webhookRes = {
        status: function (code) {
            t.equal(code, 200);
            return webhookRes;
        },
        end: function () {
            // t.pass()
        }
    };
    const awaitEvent = new Promise(resolve => {
        onfido.on('check:' + result, function (check) {
            t.equal(check.applicant, permalink);
            t.equal(check.latestDocument, license.link);
            t.equal(check.latestPhoto, photo.link);
            t.equal(check.result, result);
            t.equal(check.status, 'complete');
            resolve();
        });
    });
    yield onfido.processEvent(webhookReq, webhookRes);
    try {
        yield onfido.checks.pending(permalink);
        t.fail('should not have pending check');
    }
    catch (err) { }
    yield awaitEvent;
    t.end();
})));
function adjustCheck(obj, props) {
    const copy = Object.assign({}, obj, props);
    if (copy.reports) {
        copy.reports = copy.reports.map(r => (Object.assign({}, r, props)));
    }
    return copy;
}
function toStub(resource) {
    return buildResource.stub({ models: models_1.default, resource });
}
function newApplicantInfo() {
    const identity = fakeResource({
        models: models_1.default,
        model: models_1.default['tradle.Identity'],
        signed: true
    });
    const stub = buildResource.stub({
        models: models_1.default,
        resource: identity
    });
    return {
        identity,
        stub
    };
}
function loudAsync(asyncFn) {
    return (...args) => __awaiter(this, void 0, void 0, function* () {
        try {
            return yield asyncFn(...args);
        }
        catch (err) {
            console.error(err);
            throw err;
        }
    });
}
//# sourceMappingURL=index.js.map