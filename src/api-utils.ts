import { TYPE } from '@tradle/constants'
import buildResource = require('@tradle/build-resource')
import { equalish, parseStub } from './utils'
import { ILogger } from './types'
import { Onfido } from './'
import models from './models'

export default class APIUtils {
  public productsAPI: any
  public onfidoAPI: any
  public bot: any
  public logger: ILogger
  private db: any
  constructor ({ logger, onfidoAPI, productsAPI }: Onfido) {
    this.logger = logger
    this.onfidoAPI = onfidoAPI
    this.productsAPI = productsAPI
    this.bot = productsAPI.bot
    this.db = productsAPI.bot.db
  }

  public getResource = async (resource, req?):Promise<any> => {
    if (resource[TYPE]) return resource

    const { type, link, permalink } = resource.id ? parseStub(resource) : resource
    if (req) {
      const { payload } = req
      if (payload && payload._link === link) {
        return payload
      }
    }

    const result = await this.db.get({
      [TYPE]: type,
      _permalink: permalink
    })

    await this.bot.resolveEmbeds(result)
    return result
  }

  public getUser = async (permalink:string, req?):Promise<any> => {
    if (req) {
      const { user } = req
      if (user && user.id === permalink) {
        return user
      }
    }

    return await this.bot.users.get(permalink)
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
      models,
      resource
    })
  }

  public setProps = (resource, properties) => {
    buildResource.set({
      models,
      resource,
      properties
    })
  }

  public isTestMode () {
    return this.onfidoAPI.mode === 'test'
  }
}
