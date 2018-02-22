import Onfido from './plugin'
import { PluginOpts } from './types'

const createPlugin = (opts:PluginOpts) => new Onfido(opts)

export {
  createPlugin,
  Onfido
}
