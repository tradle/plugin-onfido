import Onfido from './plugin'

const createPlugin = opts => new Onfido(opts)

export {
  createPlugin,
  Onfido
}
