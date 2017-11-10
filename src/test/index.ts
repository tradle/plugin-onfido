import { install as installSourceMaps } from 'source-map-support'
installSourceMaps()

import test = require('tape')
import sinon = require('sinon')
import omit = require('object.omit')
import parseDataUri = require('parse-data-uri')
import { TYPE, SIG } from '@tradle/constants'
import buildResource = require('@tradle/build-resource')
import validateResource = require('@tradle/validate-resource')
import fakeResource = require('@tradle/build-resource/fake')
import createPlugin from '../'
import mock from './mock'
import fixtures from './fixtures'
import models from '../models'
import { getEnumValueId, getLatestFormByType, addLinks, parseCheckURL } from '../utils'
import onfidoModels from '../onfido-models'
import { APPLICATION } from '../constants'

const forms = fixtures.tradle
const formsByType = {}
for (let name in forms) {
  let form = forms[name]
  addLinks(form)
  formsByType[forms[name][TYPE]] = form
}

const formStubs = {}
for (let name in forms) {
  formStubs[name] = toStub(forms[name])
}

test('common case', loudAsync(async (t) => {
  const onfido = mock.client()

  let i = 0
  const applicantInfo = newApplicantInfo()
  const application = {
    [TYPE]: APPLICATION,
    [SIG]: mock.sig(),
    applicant: applicantInfo.stub,
    forms: [
      formStubs.name
    ]
  }

  addLinks(application)

  const check = fixtures.checks['0cc317bc-00a5-4e4b-8085-4485fceab85a'][1]
  const pendingCheck = toPendingCheck(check)

  let checkResource
  let state = {
    [TYPE]: onfidoModels.state.id,
    [SIG]: mock.sig(),
    applicant: applicantInfo.stub,
    application: buildResource.stub({
      models,
      resource: application
    })
  }

  addLinks(state)

  const uploadLivePhotoStub = sinon.stub(onfido.onfidoAPI.applicants, 'uploadLivePhoto')
    .callsFake(async (id, photo) => {
      t.equal(id, '0cc317bc-00a5-4e4b-8085-4485fceab85a')
      t.same(photo, {
        file: new Buffer('fdcdfab635b7145a806c8382a60f303e58498b0f7f74a7784c504fe58274fee2', 'hex'),
        filename: 'live-photo-51f77e2.jpg'
      })

      return
    })

  const uploadDocumentStub = sinon.stub(onfido.onfidoAPI.applicants, 'uploadDocument')
    .callsFake(async (id, doc) => {
      t.equal(id, '0cc317bc-00a5-4e4b-8085-4485fceab85a')
      t.same(doc, {
        type: 'driving_licence',
        file: new Buffer('fdcdfab635b7145a806c8382a60f303e58498b0f7f74a7784c504fe58274fee2', 'hex'),
        filename: 'driving_licence-51f77e2.jpg'
      })

      return
    })

  const createCheckStub = sinon.stub(onfido.onfidoAPI.checks, 'create')
    .callsFake(async (id, doc) => {
      t.equal(id, '0cc317bc-00a5-4e4b-8085-4485fceab85a')
      t.same(doc, {
        reports: [
          { name: 'document' },
          { name: 'facial_similarity' },
          { name: 'identity', variant: 'kyc' }
        ]
      })

      return pendingCheck
    })

  const checkAddressStub = sinon.stub(onfido.apiUtils, 'checkAddress').callsFake(address => {
    return Promise.resolve({
      addresses: [address]
    })
  })

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
    })

    return Promise.resolve(fixtures.applicants[0])
  })

  const importVerificationStub = sinon.stub(onfido.productsAPI, 'importVerification')
    .callsFake(({ verification }) => {
      t.same(omit(verification, SIG), {
        _t: 'tradle.Verification',
        document: {
          id: 'tradle.PhotoID_795f813aaae1db88ff5fffde70010bdf3b4c7bd4ac0a29e9ea23e9694797be87_795f813aaae1db88ff5fffde70010bdf3b4c7bd4ac0a29e9ea23e9694797be87',
          // id: 'tradle.PhotoID_3a89d94cb5db964fc1ffb9275a4ca4c35522407bf559a7aa08ff72db857ca798_3a89d94cb5db964fc1ffb9275a4ca4c35522407bf559a7aa08ff72db857ca798',
          title: 'Driver licence United Kingdom'
        }
      })

      return Promise.resolve()
    })

  await Promise.all([
    onfido.bot.save(application),
    onfido.bot.save(state),
  ].concat(Object.keys(forms).map(name => {
    return onfido.bot.save(forms[name])
  })))

  // not enough info
  t.equal(await onfido.applicants.createOrUpdate({
    state,
    application
  }), false, 'do not create applicant')

  application.forms = [
    formStubs.name,
    formStubs.driving_license
  ]

  t.equal(await onfido.applicants.createOrUpdate({
    state,
    application
  }), false, 'do not create applicant')

  application.forms = [
    formStubs.name,
    formStubs.passport
  ]

  t.equal(await onfido.applicants.createOrUpdate({
    state,
    application
  }), false, 'do not create applicant')

  application.forms = [
    formStubs.applicant
  ]

  t.equal(await onfido.applicants.createOrUpdate({
    state,
    application
  }), true)

  t.ok(state.onfidoApplicant)
  application.forms = [
    formStubs.applicant,
    formStubs.selfie,
    formStubs.driving_license
  ]

  t.equal(await onfido.applicants.uploadSelfie({
    state,
    application,
    form: formStubs.selfie
  }), true)

  t.ok(state.selfie)

  t.equal(await onfido.applicants.uploadPhotoID({
    state,
    application,
    form: forms.driving_license
  }), true)

  t.ok(state.photoID)

  await onfido.createCheck({ application, state })
  t.equal(state.result, undefined)
  t.ok(state.check)
  t.same(state.checkStatus, { id: 'onfido.CheckStatus_inprogress', title: 'In progress' })

  let reportIdx = 0
  sinon.stub(onfido.onfidoAPI.webhooks, 'handleEvent').callsFake(async (req, token) => {
    const report = check.reports[reportIdx]
    if (report) {
      // set completed report
      pendingCheck.reports[reportIdx] = report
      return {
        "resource_type": "report",
        "action": "report.completed",
        "object": {
          "id": report.id,
          "status": "completed",
          "completed_at": "2014-05-23 13:50:33 UTC",
          "href": `https://api.onfido.com/v2/checks/${check.id}/reports/${report.id}`
        }
      }
    }

    reportIdx++
    return {
      "resource_type": "check",
      "action": "check.completed",
      "object": {
        "id": check.id,
        "status": "completed",
        "completed_at": "2014-05-23 13:50:33 UTC",
        "href": `https://api.onfido.com/v2/checks/${check.id}`
      }
    }
  })

  sinon.stub(onfido.onfidoAPI.checks, 'get').callsFake(async (props) => {
    const { applicantId, checkId } = parseCheckURL(check)
    t.equal(props.applicantId, applicantId)
    t.equal(props.checkId, checkId)
    return check
  })

  for (let i = 0; i < check.reports.length; i++) {
    await onfido.processWebhookEvent({ req: mock.request() })
  }

  await onfido.processWebhookEvent({ req: mock.request() })

  // await onfido.createCheck({ state })
  // t.same(state.result, { id: 'onfido.OpResult_consider', title: 'Failure' })

  t.end()
}))

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

function toPendingCheck (check) {
  return {
    ...check,
    status: 'in_progress',
    result: null,
    reports: check.reports.map(report => ({
      ...report,
      status: 'awaiting_data',
      result: null
    }))
  }
}

function adjustCheck (obj, props) {
  const copy = { ...obj, ...props }
  if (copy.reports) {
    copy.reports = copy.reports.map(r => ({ ...r, ...props }))
  }

  return copy
}

function toStub (resource) {
  return buildResource.stub({ models, resource })
}

function newApplicantInfo () {
  const identity = fakeResource({
    models,
    model: models['tradle.Identity'],
    signed: true
  })

  const stub = buildResource.stub({
    models,
    resource: identity
  })

  return {
    identity,
    stub
  }
}

function loudAsync (asyncFn) {
  return async (...args) => {
    try {
      return await asyncFn(...args)
    } catch (err) {
      console.error(err)
      throw err
    }
  }
}
