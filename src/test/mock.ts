import { EventEmitter } from 'events'
import typeforce = require('typeforce')
import createPlugin from '../'
import models from './models'
import ConsoleLogger from './console-logger'

export default {
  client: mockClient,
  api: mockAPI
}

function mockClient (opts) {
  const onfidoAPI = mockAPI(opts)
  return createPlugin({
    logger: new ConsoleLogger(),
    onfidoAPI,
    productsAPI: {
      models: {
        all: models
      },
      bot: {
        db: {
          get: () => {
            throw new Error('not found')
          }
        }
      }
    }
  })
}

function mockAPI () {//{ applicants, documents, checks, reports }) {
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
