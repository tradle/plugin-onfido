import Onfido from './plugin'
import models from './onfido-models'

const createPlugin = opts => new Onfido(opts)

export {
  createPlugin,
  Onfido,
  models
}
