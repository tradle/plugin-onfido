import { TYPE } from '@tradle/constants'
import buildResource = require('@tradle/build-resource')
import { equalish, parseStub } from './utils'
import { ILogger } from './types'
import { Onfido } from './'

export default class APIUtils {
  public productsAPI: any
  public onfidoAPI: any
  public logger: ILogger
  public models: any
  private db: any
  constructor ({ logger, models, onfidoAPI, productsAPI }: Onfido) {
    this.logger = logger
    this.onfidoAPI = onfidoAPI
    this.productsAPI = productsAPI
    this.db = productsAPI.bot.db
    this.models = models
  }

  public getResource = async (resource):Promise<any> => {
    if (resource[TYPE]) return resource

    const { type, permalink } = resource.id ? parseStub(resource) : resource
    return this.db.get({
      [TYPE]: type,
      _permalink: permalink
    })
  }

  public checkAddress = async ({ address }) => {
    if (address.country !== 'GBR') {
      this.logger.debug('can only check address validity for UK addresses')
      return
    }

    let validAddresses = []
    try {
      const result = await this.onfidoAPI.misc.getAddressesForPostcode({
        postcode: address.postcode
      })

      validAddresses = result.addresses
    } catch (err) {
      this.logger.error('failed to access Onfido Address Picker', err)
      return false
    }

    const closestMatch = validAddresses.find(valid => {
      for (let p in valid) {
        let val = valid[p]
        if (val != null && address[p] != null) {
          if (!equalish(val, address[p])) return false
        }
      }

      return true
    })

    if (!closestMatch) {
      this.logger.info(`no valid address found to match applicants: ${JSON.stringify(address)}`)
      return false
    }

    return true
  }

  public stub = (resource:any) => {
    return buildResource.stub({
      models: this.models,
      resource
    })
  }

  public isTestMode () {
    return this.onfidoAPI.mode === 'test'
  }
}
