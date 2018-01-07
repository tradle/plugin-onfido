import { models as baseModels } from '@tradle/models'
import customModels = require('@tradle/custom-models')

const productsBotModels = require('@tradle/models-products-bot')
const onfidoModels = require('@tradle/models-onfido')
const models = {
  ...baseModels,
  ...customModels,
  ...productsBotModels,
  ...onfidoModels
}

export default models
