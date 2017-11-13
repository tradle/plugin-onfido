import Onfido from './plugin';
import models from './onfido-models';
declare const createPlugin: (opts: any) => Onfido;
export { createPlugin, Onfido, models };
