import { models as baseModels } from '@tradle/models'
import customModels = require('@tradle/custom-models')
import mergeModels = require('@tradle/merge-models')
import onfidoModels from './onfido-models'

const models = mergeModels()
  .add(baseModels, { validate: false })
  .add(customModels, { validate: false })
  .add(onfidoModels.all)
  .get()

export default models
