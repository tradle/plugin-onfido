"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const source_map_support_1 = require("source-map-support");
source_map_support_1.install();
const test = require("tape");
const sinon = require("sinon");
const _ = require("lodash");
const constants_1 = require("@tradle/constants");
const buildResource = require("@tradle/build-resource");
const fakeResource = require("@tradle/build-resource/fake");
const mock_1 = __importDefault(require("./mock"));
const fixtures_1 = __importDefault(require("./fixtures"));
const models_1 = __importDefault(require("../models"));
const utils_1 = require("../utils");
const onfido_models_1 = __importDefault(require("../onfido-models"));
const constants_2 = require("../constants");
const fixStub = utils_1.stubFromParsedStub;
const forms = fixtures_1.default.tradle;
const formsByType = {};
for (let name in forms) {
    let form = forms[name];
    utils_1.addLinks(form);
    formsByType[forms[name][constants_1.TYPE]] = form;
}
const formStubs = {};
for (let name in forms) {
    formStubs[name] = toStub(forms[name]);
}
const TEST_PRODUCT = {
    type: 'tradle.Model',
    id: 'test.Product',
    title: 'test product',
    subClassOf: 'tradle.FinancialProduct',
    forms: [
        'tradle.Name',
        'tradle.PhotoID',
        constants_2.APPLICANT
    ],
    properties: {}
};
const setup = () => {
    const onfido = mock_1.default.client({
        products: [{
                product: TEST_PRODUCT.id,
                reports: constants_2.REPORTS.slice()
            }]
    });
    let i = 0;
    const applicantInfo = newApplicantInfo();
    const application = buildResource({
        models: models_1.default,
        model: constants_2.APPLICATION,
    })
        .set({
        [constants_1.SIG]: mock_1.default.sig(),
        context: 'abc',
        applicant: applicantInfo.stub,
        requestFor: TEST_PRODUCT.id,
    })
        .toJSON({ stripSig: false });
    application.forms = [
        formStubs.name
    ].map(toAppSub);
    utils_1.addLinks(application);
    const completedCheck = _.cloneDeep(fixtures_1.default.checks.complete);
    const pendingCheck = _.cloneDeep(fixtures_1.default.checks.pending);
    const check = onfido.bot.draft({
        resource: {
            [constants_1.TYPE]: onfido_models_1.default.check.id,
            [constants_1.SIG]: mock_1.default.sig(),
            applicant: applicantInfo.stub,
            application: buildResource.stub({
                models: models_1.default,
                resource: application
            })
        }
    });
    return {
        onfido,
        application,
        check,
        completedCheck,
        pendingCheck,
        user: applicantInfo.user
    };
};
test('common case', loudAsync(async (t) => {
    let { onfido, check, application, completedCheck, pendingCheck, user } = setup();
    onfido.bot.users.get = async (id) => {
        if (id !== user.id) {
            throw new Error('user not found');
        }
        return user;
    };
    const uploadLivePhotoStub = sinon.stub(onfido.onfidoAPI.applicants, 'uploadLivePhoto')
        .callsFake(async (id, photo) => {
        t.equal(id, '0cc317bc-00a5-4e4b-8085-4485fceab85a');
        t.same(photo, {
            file: new Buffer('fdcdfab635b7145a806c8382a60f303e58498b0f7f74a7784c504fe58274fee2', 'hex'),
            filename: 'live-photo-51f77e2.jpg'
        });
        return;
    });
    const uploadDocumentStub = sinon.stub(onfido.onfidoAPI.applicants, 'uploadDocument')
        .callsFake(async (id, doc) => {
        t.equal(id, '0cc317bc-00a5-4e4b-8085-4485fceab85a');
        t.same(doc, {
            type: 'driving_licence',
            file: new Buffer('fdcdfab635b7145a806c8382a60f303e58498b0f7f74a7784c504fe58274fee2', 'hex'),
            filename: 'driving_licence-51f77e2.jpg'
        });
        return;
    });
    const createCheckStub = sinon.stub(onfido.onfidoAPI.checks, 'create')
        .callsFake(async (id, doc) => {
        t.equal(id, '0cc317bc-00a5-4e4b-8085-4485fceab85a');
        t.same(doc, {
            reports: [
                { name: 'document' },
                { name: 'facial_similarity' },
                { name: 'identity', variant: 'kyc' }
            ]
        });
        return pendingCheck;
    });
    const checkAddressStub = sinon.stub(onfido.apiUtils, 'checkAddress').callsFake(address => {
        return Promise.resolve({
            addresses: [address]
        });
    });
    const createApplicantStub = sinon.stub(onfido.onfidoAPI.applicants, 'create').callsFake(async (props) => {
        t.same(props, {
            "first_name": "MOOG",
            "last_name": "SONI",
            "dob": "1981-04-03",
            "addresses": [
                {
                    "country": "GBR",
                    "building_number": "96",
                    "street": "Thornfield Rd",
                    "town": "Middlesbrough",
                    "postcode": "TS5 5BY"
                }
            ]
        });
        // const err = _.extend(new Error('test error'), {
        //   status: 422,
        //   body: {
        //     type: 'validation_error',
        //     fields: {
        //       "addresses": [{ "postcode": "Invalid postcode" }]
        //     }
        //   }
        // })
        // return Promise.reject(err)
        return fixtures_1.default.applicants[0];
    });
    let vIdx = 0;
    const importVerificationStub = sinon.stub(onfido.applications, 'createVerification')
        .callsFake(async ({ verification }) => {
        verification = _.omit(verification, constants_1.SIG);
        if (vIdx === 0) {
            t.ok(areStubsEqual(verification.document, formStubs.driving_license));
        }
        else if (vIdx === 1) {
            t.ok(areStubsEqual(verification.document, formStubs.selfie));
        }
        else if (vIdx === 2) {
            t.ok(areStubsEqual(verification.document, formStubs.applicant));
        }
        vIdx++;
    });
    await Promise.all([
        onfido.bot.save(application),
        check.save(),
    ].concat(Object.keys(forms).map(name => {
        return onfido.bot.save(forms[name]);
    })));
    // not enough info
    t.equal(await onfido.applicants.createOrUpdate({
        check,
        application
    }), false, 'do not create applicant');
    application.forms = [
        formStubs.name,
        formStubs.driving_license
    ].map(toAppSub);
    t.equal(await onfido.applicants.createOrUpdate({
        check,
        application
    }), false, 'do not create applicant');
    application.forms = [
        formStubs.name,
        formStubs.passport
    ].map(toAppSub);
    t.equal(await onfido.applicants.createOrUpdate({
        check,
        application
    }), false, 'do not create applicant');
    application.forms = [
        formStubs.applicant
    ].map(toAppSub);
    sinon.stub(onfido.applications, 'requestEdit').callsFake(async ({ item, details }) => {
        t.equal(details.errors[0].name, 'postcode');
    });
    await onfido.handleOnfidoError({
        req: { check, application },
        error: _.extend(new Error('test error'), {
            status: 422,
            body: {
                type: 'validation_error',
                fields: {
                    "addresses": [{ "postcode": "Invalid postcode" }]
                }
            }
        })
    });
    t.equal(await onfido.applicants.createOrUpdate({
        check,
        application
    }), true);
    t.ok(check.get('onfidoApplicant'));
    application.forms = [
        formStubs.applicant,
        formStubs.selfie,
        formStubs.driving_license
    ].map(toAppSub);
    t.equal(await onfido.applicants.uploadSelfie({
        check,
        application,
        form: forms.selfie
    }), true);
    t.ok(check.get('selfie'));
    t.equal(await onfido.applicants.uploadPhotoID({
        check,
        application,
        form: forms.driving_license
    }), true);
    t.ok(check.get('photoID'));
    await onfido.createOnfidoCheck({ application, check });
    t.equal(check.get('onfidoResult'), undefined);
    t.ok(check.get('rawData'));
    // t.same(check.get('onfidoStatus'), fixStub({ id: 'tradle.onfido.CheckStatus_inprogress', title: 'In progress' }))
    let reportIdx = 0;
    sinon.stub(onfido.onfidoAPI.webhooks, 'handleEvent').callsFake(async (req, token) => {
        const report = pendingCheck.reports[reportIdx];
        if (report) {
            // set completed report
            pendingCheck.reports[reportIdx] = completedCheck.reports[reportIdx];
            reportIdx++;
            return {
                "resource_type": "report",
                "action": "report.completed",
                "object": {
                    "id": report.id,
                    "status": "completed",
                    "completed_at": "2014-05-23 13:50:33 UTC",
                    "href": `https://api.onfido.com/v2/checks/${pendingCheck.id}/reports/${report.id}`
                }
            };
        }
        pendingCheck = completedCheck;
        return {
            "resource_type": "check",
            "action": "check.completed",
            "object": {
                "id": pendingCheck.id,
                "status": "completed",
                "completed_at": "2014-05-23 13:50:33 UTC",
                "href": `https://api.onfido.com/v2/checks/${pendingCheck.id}`
            }
        };
    });
    sinon.stub(onfido.onfidoAPI.checks, 'get').callsFake(async (props) => {
        const { applicantId, checkId } = utils_1.parseCheckURL(pendingCheck);
        t.equal(props.applicantId, applicantId);
        t.equal(props.checkId, checkId);
        return pendingCheck;
    });
    for (let i = 0; i < pendingCheck.reports.length; i++) {
        await onfido.processWebhookEvent({ req: mock_1.default.request() });
    }
    await onfido.processWebhookEvent({ req: mock_1.default.request() });
    t.equal(vIdx, 3);
    // await onfido.createCheck({ state })
    // t.same(state.result, { id: 'tradle.onfido.OpResult_consider', title: 'Failure' })
    t.end();
}));
test('plugin methods', loudAsync(async (t) => {
    const { onfido, check, application, completedCheck, pendingCheck } = setup();
    const moog = {
        first_name: 'MOOG',
        last_name: 'SONI',
        dob: '1981-04-03',
        addresses: [{
                country: 'GBR',
                building_number: '96',
                street: 'Thornfield Rd',
                town: 'Middlesbrough',
                postcode: 'TS5 5BY'
            }]
    };
    const createApplicantStub = sinon.stub(onfido.onfidoAPI.applicants, 'create')
        .callsFake(async (props) => {
        t.same(props, moog);
        return Object.assign({}, fixtures_1.default.applicants[0], moog);
    });
    const updateApplicantSpy = sinon.spy(onfido.onfidoAPI.applicants, 'update');
    const uploadLivePhotoStub = sinon.stub(onfido.onfidoAPI.applicants, 'uploadLivePhoto')
        .callsFake(async (id, photo) => {
        t.equal(id, '0cc317bc-00a5-4e4b-8085-4485fceab85a');
        t.same(photo, {
            file: new Buffer('fdcdfab635b7145a806c8382a60f303e58498b0f7f74a7784c504fe58274fee2', 'hex'),
            filename: 'live-photo-51f77e2.jpg'
        });
        return;
    });
    const uploadDocumentStub = sinon.stub(onfido.onfidoAPI.applicants, 'uploadDocument')
        .callsFake(async (id, doc) => {
        t.equal(id, '0cc317bc-00a5-4e4b-8085-4485fceab85a');
        t.same(doc, {
            type: 'driving_licence',
            file: new Buffer('fdcdfab635b7145a806c8382a60f303e58498b0f7f74a7784c504fe58274fee2', 'hex'),
            filename: 'driving_licence-51f77e2.jpg'
        });
        return;
    });
    const createCheckStub = sinon.stub(onfido.onfidoAPI.checks, 'create')
        .callsFake(async (id, doc) => {
        t.equal(id, '0cc317bc-00a5-4e4b-8085-4485fceab85a');
        return pendingCheck;
    });
    await Promise.all(Object.keys(forms).map(name => {
        return onfido.bot.save(forms[name]);
    }));
    const receive = async (payload) => {
        await onfido['onmessage:tradle.Form']({ payload, application });
        application.forms.push(toAppSub(payload));
        await onfido.bot.save(application);
    };
    await receive(forms.name);
    t.equal(createApplicantStub.callCount, 0);
    t.equal(uploadLivePhotoStub.callCount, 0);
    t.equal(uploadDocumentStub.callCount, 0);
    t.equal(updateApplicantSpy.callCount, 0);
    t.equal(createCheckStub.callCount, 0);
    await receive(forms.driving_license);
    t.equal(createApplicantStub.callCount, 0);
    t.equal(uploadLivePhotoStub.callCount, 0);
    t.equal(uploadDocumentStub.callCount, 0);
    t.equal(updateApplicantSpy.callCount, 0);
    t.equal(createCheckStub.callCount, 0);
    await receive(forms.applicant);
    t.equal(createApplicantStub.callCount, 1);
    t.equal(uploadLivePhotoStub.callCount, 0);
    t.equal(uploadDocumentStub.callCount, 1);
    t.equal(updateApplicantSpy.callCount, 0);
    t.equal(createCheckStub.callCount, 0);
    await receive(forms.selfie);
    t.equal(createApplicantStub.callCount, 1);
    t.equal(uploadLivePhotoStub.callCount, 1);
    t.equal(uploadDocumentStub.callCount, 1);
    t.equal(updateApplicantSpy.callCount, 0);
    t.equal(createCheckStub.callCount, 1);
    t.end();
}));
// test('upload doc + selfie', loudAsync(async (t) => {
//   const result = 'clear'
//   const applicant = fixtures.applicants[0]
//   const applicantId = applicant.id
//   const check = adjustCheck(fixtures.checks[applicantId][1], { result: null, status: 'in_progress' })
//   const document = fixtures.documents[applicantId][0]
//   const pendingReport = check.reports[0]
//   const completeCheck = adjustCheck(check, { status: 'complete', result })
//   const onfido = mock.client()
//   const applicantInfo = newApplicantInfo()
//   const getResourceStub = sinon.stub(onfido.bot.db, 'get').callsFake(props => {
//     if (i++ === 0) {
//       t.equal(props._permalink, forms.applicant._permalink)
//       return Promise.resolve(forms.applicant)
//     } else {
//       t.equal(props._permalink, buildResource.permalink(applicantInfo.identity))
//       // return Promise.resolve(fixtures.applicants[0])
//       return Promise.reject(new Error('no applicant found'))
//     }
//   })
//   try {
//     await onfido.checks.create({ applicant: permalink, checkDocument: true })
//     t.fail('should not be able to create check before uploading a document')
//   } catch (err) {
//     t.ok(/upload document/.test(err.message))
//   }
//   const license = fixtures.inputs.license
//   const photo = fixtures.inputs.selfie
//   await onfido.uploadDocument({
//     applicant: permalink,
//     document: license
//   })
//   try {
//     await onfido.checks.create({ applicant: permalink, checkDocument: true, checkFace: true })
//     t.fail('should not be able to create a face check before uploading a live photo')
//   } catch (err) {
//     t.ok(/upload a photo/.test(err.message))
//   }
//   await onfido.uploadLivePhoto({
//     applicant: permalink,
//     photo: photo
//   })
//   await onfido.checks.create({
//     applicant: permalink,
//     checkDocument: true,
//     checkFace: true
//   })
//   const pending = await onfido.checks.pending(permalink)
//   t.same(pending, {
//     applicant: permalink,
//     applicantId: applicantId,
//     onfido: check,
//     latestDocument: license.link,
//     latestPhoto: photo.link,
//     checkDocument: true,
//     checkFace: true,
//     result: null,
//     status: 'in_progress'
//   })
//   const webhookReq = new PassThrough()
//   webhookReq.write(JSON.stringify({
//     payload: {
//       resource_type: 'check',
//       action: 'check.completed',
//       object: {
//         id: check.id,
//         status: 'completed',
//         completed_at: new Date().toJSON(), // for correct format
//         href: check.href,
//         reports: completeCheck.reports
//       }
//     }
//   }))
//   webhookReq.end()
//   const webhookRes = {
//     status: function (code) {
//       t.equal(code, 200)
//       return webhookRes
//     },
//     end: function () {
//       // t.pass()
//     }
//   }
//   const awaitEvent = new Promise(resolve => {
//     onfido.on('check:' + result, function (check) {
//       t.equal(check.applicant, permalink)
//       t.equal(check.latestDocument, license.link)
//       t.equal(check.latestPhoto, photo.link)
//       t.equal(check.result, result)
//       t.equal(check.status, 'complete')
//       resolve()
//     })
//   })
//   await onfido.processEvent(webhookReq, webhookRes)
//   try {
//     await onfido.checks.pending(permalink)
//     t.fail('should not have pending check')
//   } catch (err) {}
//   await awaitEvent
//   t.end()
// }))
function toPendingCheck(check) {
    return Object.assign({}, check, { status: 'in_progress', result: null, reports: check.reports.map(report => (Object.assign({}, report, { status: 'awaiting_data', result: null }))) });
}
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
        user: buildResource.stub({ resource: identity }),
        identity,
        stub
    };
}
function loudAsync(asyncFn) {
    return async (...args) => {
        try {
            return await asyncFn(...args);
        }
        catch (err) {
            console.error(err);
            throw err;
        }
    };
}
function toAppSub(submission) {
    return {
        submission: submission[constants_1.TYPE] ? toStub(submission) : submission
    };
}
const areStubsEqual = (a, b) => {
    return _.isEqual(toBareStub(a), toBareStub(b));
};
const toBareStub = stub => _.omit(stub, '_displayName');
//# sourceMappingURL=index.js.map