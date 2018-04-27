"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class ConsoleLogger {
    constructor() {
        this.log = console.log.bind(console);
        this.silly = console.log.bind(console);
        this.debug = console.log.bind(console);
        this.info = console.info.bind(console);
        this.warn = console.warn.bind(console);
        this.error = console.error.bind(console);
    }
}
exports.default = ConsoleLogger;
//# sourceMappingURL=console-logger.js.map