import { ILogger } from '../types';
export default class ConsoleLogger implements ILogger {
    log: any;
    info: any;
    warn: any;
    debug: any;
    error: any;
}
