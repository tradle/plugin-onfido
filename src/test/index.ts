import { install as installSourceMaps } from 'source-map-support'
installSourceMaps()

import test = require('tape')
import sinon = require('sinon')
import parseDataUri = require('parse-data-uri')
import { TYPE } from '@tradle/constants'
import buildResource = require('@tradle/build-resource')
import validateResource = require('@tradle/validate-resource')
import fakeResource = require('@tradle/build-resource/fake')
import createPlugin from '../'
import mock from './mock'
import fixtures from './fixtures'
import models from './models'
import { getEnumValueId, getLatestFormByType } from '../utils'
import onfidoModels from '../onfido-models'

const forms = fixtures.tradle
const formsByType = {}
for (let name in forms) {
  formsByType[forms[name][TYPE]] = forms[name]
}

const formStubs = {}
for (let name in forms) {
  formStubs[name] = toStub(forms[name])
}

test.only('create applicant', loudAsync(async (t) => {
  // t.plan(5)

  const onfido = mock.client()

  let i = 0
  const applicantInfo = newApplicantInfo()
  const application = {
    applicant: applicantInfo.stub,
    forms: [
      formStubs.name
    ]
  }

  const getResourceStub = sinon.stub(onfido.bot.db, 'get').callsFake(async (props) => {
    const { type } = getLatestFormByType(application, props[TYPE])
    return formsByType[type]
  })

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

  const state = {}

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

  getResourceStub.restore()
  checkAddressStub.restore()
  t.end()
}))

test('upload doc + selfie', loudAsync(async (t) => {
  const result = 'clear'
  const applicant = fixtures.applicants[0]
  const applicantId = applicant.id
  const check = adjustCheck(fixtures.checks[applicantId][1], { result: null, status: 'in_progress' })
  const document = fixtures.documents[applicantId][0]
  const pendingReport = check.reports[0]
  const completeCheck = adjustCheck(check, { status: 'complete', result })
  const onfido = mock.client()
  const applicantInfo = newApplicantInfo()
  const getResourceStub = sinon.stub(onfido.bot.db, 'get').callsFake(props => {
    if (i++ === 0) {
      t.equal(props._permalink, forms.applicant._permalink)
      return Promise.resolve(forms.applicant)
    } else {
      t.equal(props._permalink, buildResource.permalink(applicantInfo.identity))
      // return Promise.resolve(fixtures.applicants[0])
      return Promise.reject(new Error('no applicant found'))
    }
  })

  try {
    await onfido.checks.create({ applicant: permalink, checkDocument: true })
    t.fail('should not be able to create check before uploading a document')
  } catch (err) {
    t.ok(/upload document/.test(err.message))
  }

  const license = fixtures.inputs.license
  const photo = fixtures.inputs.selfie
  await onfido.uploadDocument({
    applicant: permalink,
    document: license
  })

  try {
    await onfido.checks.create({ applicant: permalink, checkDocument: true, checkFace: true })
    t.fail('should not be able to create a face check before uploading a live photo')
  } catch (err) {
    t.ok(/upload a photo/.test(err.message))
  }

  await onfido.uploadLivePhoto({
    applicant: permalink,
    photo: photo
  })

  await onfido.checks.create({
    applicant: permalink,
    checkDocument: true,
    checkFace: true
  })

  const pending = await onfido.checks.pending(permalink)
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
  })

  const webhookReq = new PassThrough()
  webhookReq.write(JSON.stringify({
    payload: {
      resource_type: 'check',
      action: 'check.completed',
      object: {
        id: check.id,
        status: 'completed',
        completed_at: new Date().toJSON(), // for correct format
        href: check.href,
        reports: completeCheck.reports
      }
    }
  }))

  webhookReq.end()

  const webhookRes = {
    status: function (code) {
      t.equal(code, 200)
      return webhookRes
    },
    end: function () {
      // t.pass()
    }
  }

  const awaitEvent = new Promise(resolve => {
    onfido.on('check:' + result, function (check) {
      t.equal(check.applicant, permalink)
      t.equal(check.latestDocument, license.link)
      t.equal(check.latestPhoto, photo.link)
      t.equal(check.result, result)
      t.equal(check.status, 'complete')
      resolve()
    })
  })

  await onfido.processEvent(webhookReq, webhookRes)
  try {
    await onfido.checks.pending(permalink)
    t.fail('should not have pending check')
  } catch (err) {}

  await awaitEvent

  t.end()
}))

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
