import crypto = require('crypto')
import { EventEmitter } from 'events'
import _ from 'lodash'
import typeforce = require('typeforce')
import { TYPE, PERMALINK, PREVLINK, SIG, VERSION } from '@tradle/constants'
import buildResource = require('@tradle/build-resource')
import fakeResource = require('@tradle/build-resource/fake')
import models from '../models'
import ConsoleLogger from './console-logger'
import { Onfido, createPlugin } from '../'
import { addLinks, parseStub } from '../utils'
import { DEFAULT_WEBHOOK_KEY } from '../constants'

const keyValueStore = () => {
  const store = {}
  return {
    get: async (key) => {
      if (key in store) return store[key]

      throw notFoundError(`key ${key} not found`)
    },
    put: async (key, value) => {
      store[key] = value
    },
    sub: () => keyValueStore()
  }
}

export default {
  client: mockClient,
  api: mockAPI,
  keyValueStore,
  sig: newSig,
  request: mockRequest
}

function mockClient ({ products, ...rest }) {
  const onfidoAPI = mockAPI()
  const bot = mockBot()
  const plugin = createPlugin({
    formsToRequestCorrectionsFor: ['tradle.onfido.Applicant', 'tradle.Selfie'],
    logger: new ConsoleLogger(),
    bot,
    onfidoAPI,
    applications: {
      createVerification: ({ application, verification }) => {
        throw new Error('mock me')
      },
      requestEdit: async () => {
        throw new Error('mock me')
      }
    },
    products,
    ...rest
  })

  plugin.conf.put(DEFAULT_WEBHOOK_KEY, { token: 'testtoken' })
  return plugin
}

const wrapResource = (resource, bot) => {
  resource = _.cloneDeep(resource)
  if (resource[SIG]) addLinks(resource)

  let isModified
  const wrapper = {
    get(key) {
      return resource[key]
    },
    set(key, value?) {
      isModified = true

      if (typeof key === 'string') {
        resource[key] = value
      } else {
        _.extend(resource, key)
      }

      return this
    },
    async sign() {
      resource[SIG] = newSig()
      addLinks(resource)
      return this
    },
    async save() {
      addLinks(resource)
      isModified = false
      await bot.save(resource)
    },
    async signAndSave() {
      if (resource[SIG]) {
        resource[VERSION] = (resource[VERSION] || 0) + 1
        resource[PERMALINK] = resource._link
        resource[PERMALINK] = resource._permalink
      } else {
        resource[VERSION] = 0
      }

      await wrapper.sign()
      await wrapper.save()
      return this
    },
    toJSON(opts) {
      return _.cloneDeep(resource)
    },
    isModified() {
      return isModified
    }
  }

  return wrapper
}

function mockBot () {
  const db = {}
  const getKey = resource => {
    const type = resource[TYPE]
    const permalink = resource._permalink
    if (!(type && permalink)) {
      debugger
      throw new Error(`expected ${TYPE} and _permalink`)
    }

    return JSON.stringify({ type, permalink })
  }

  const sign = async (resource) => {
    return {
      ...resource,
      [SIG]: newSig()
    }
  }

  const save = async (resource) => {
    db[getKey(resource)] = resource
  }

  const draft = type => wrapResource({
    [TYPE]: type
  }, bot)

  const dbMock = {
    get: async (props) => {
      const val = db[getKey(props)]
      if (val) return val

      throw notFoundError(`not found: ${JSON.stringify(props)}`)
    },
    find: async ({ filter }) => {
      const { EQ } = filter
      const items = []
      for (let key in db) {
        let item = db[key]
        for (let prop in EQ) {
          if (_.isEqual(_.get(item, prop), EQ[prop])) {
            items.push(item)
          }
        }
      }

      return { items }
    },
    findOne: async (opts) => {
      const item = (await dbMock.find(opts)).items[0]
      if (item) return item

      throw notFoundError(`not found: ${JSON.stringify(opts)}`)
    }
  }

  const bot = {
    models,
    resolveEmbeds: () => {},
    draft,
    sign,
    save,
    kv: keyValueStore(),
    conf: keyValueStore(),
    users: {
      get: async (id) => {
        throw new Error('users.get() not mocked')
      }
    },
    db: dbMock
  }

  return bot
}

function mockAPI () {
  return {
    applicants: {
      get: async (id) => {
        throw new Error('mock me')
      },
      create: async (obj) => {
        throw new Error('mock me')
      },
      update: async (id, obj) => {
        throw new Error('mock me')
      },
      uploadDocument: async (id, obj) => {
        throw new Error('mock me')
      },
      uploadLivePhoto: async (id, obj) => {
        throw new Error('mock me')
      }
    },
    checks: {
      get: async (opts) => {
        throw new Error('mock me')
      },
      create: async (id, opts) => {
        throw new Error('mock me')
      },
      createDocumentCheck: async (id) => {
        throw new Error('mock me')
      }
    },
    reports: {
      // get: function (id) {
      //   typeforce(typeforce.String, id)

      //   if (report) {
      //     return Promise.resolve(reports.shift())
      //   }

      //   const match = check.reports.find(r => r.id === id)
      //   if (match) Promise.resolve(match)
      //   else Promise.reject(new Error('report not found'))
      // }
    },
    webhooks: {
      handleEvent: (req) => {
        return new Promise((resolve, reject) => {
          let body
          req
            .on('data', data => body += data.toString())
            .on('end', () => resolve(JSON.parse(body).payload))
            .on('error', reject)
        })
      }
    },
    misc: {
      getAddressesForPostcode: async () => {
        throw new Error('mock me')
      }
    }
  }
}

function newSig () {
  return crypto.randomBytes(128).toString('base64')
}

function mockRequest () {
  return {
    get: prop => `mock value for ${prop}`,
    originalUrl: 'mock original url'
  }
}

function notFoundError (message) {
  const err = new Error(message)
  err.name = 'NotFound'
  return err
}
