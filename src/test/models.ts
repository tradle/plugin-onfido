import { models as baseModels } from '@tradle/models'
import customModels = require('@tradle/custom-models')
import mergeModels = require('@tradle/merge-models')

const models = mergeModels()
  .add(baseModels)
  .add(customModels)
  .get()

export default models
