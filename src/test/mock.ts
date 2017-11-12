import crypto = require('crypto')
import { EventEmitter } from 'events'
import typeforce = require('typeforce')
import pick = require('object.pick')
import { TYPE, SIG } from '@tradle/constants'
import buildResource = require('@tradle/build-resource')
import fakeResource = require('@tradle/build-resource/fake')
import createPlugin from '../'
import models from '../models'
import ConsoleLogger from './console-logger'
import { Onfido } from '../'
import { addLinks } from '../utils'
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
    }
  }
}

export default {
  client: mockClient,
  api: mockAPI,
  keyValueStore,
  sig: newSig,
  request: mockRequest
}

function mockClient (opts={}) {
  const onfidoAPI = mockAPI()
  const bot = mockBot()
  return createPlugin({
    logger: new ConsoleLogger(),
    onfidoAPI,
    productsAPI: {
      models: {
        all: models
      },
      importVerification: (verification) => {
        throw new Error('mock me')
      },
      bot,
      saveNewVersionOfApplication: async ({ application }) => {
        return await bot.versionAndSave(application)
      }
    },
    ...opts
  })
}

function mockBot () {
  const db = {}
  const getKey = resource => {
    const type = resource[TYPE]
    const permalink = resource._permalink
    if (!(type && permalink)) {
      throw new Error(`expected ${TYPE} and _permalink`)
    }

    return JSON.stringify({ type, permalink })
  }

  const sign = async (resource) => {
    resource[SIG] = newSig()
    return resource
  }

  const save = async (resource) => {
    db[getKey(resource)] = resource
  }

  const signAndSave = async (resource) => {
    await sign(resource)
    addLinks(resource)
    await save(resource)
    return resource
  }

  const version = async (resource) => {
    buildResource.version(resource)
    return sign(resource)
  }

  const versionAndSave = async (resource) => {
    const ver = await version(resource)
    await save(ver)
    return ver
  }

  return {
    sign,
    save,
    signAndSave,
    version,
    versionAndSave,
    kv: keyValueStore(),
    conf: (function () {
      const store = keyValueStore()
      store.put(DEFAULT_WEBHOOK_KEY, { token: 'testtoken' })
      return store
    })(),
    db: {
      get: async (props) => {
        const val = db[getKey(props)]
        if (val) return val

        throw notFoundError(`not found: ${JSON.stringify(props)}`)
      }
    }
  }
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
