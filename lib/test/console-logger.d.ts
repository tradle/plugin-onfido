import { ILogger } from '../types';
export default class ConsoleLogger implements ILogger {
    log: any;
    silly: any;
    debug: any;
    info: any;
    warn: any;
    error: any;
}
