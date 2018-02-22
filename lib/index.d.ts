import Onfido from './plugin';
import { PluginOpts } from './types';
declare const createPlugin: (opts: PluginOpts) => Onfido;
export { createPlugin, Onfido };
