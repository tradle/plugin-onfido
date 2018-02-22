"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const plugin_1 = require("./plugin");
exports.Onfido = plugin_1.default;
const createPlugin = (opts) => new plugin_1.default(opts);
exports.createPlugin = createPlugin;
//# sourceMappingURL=index.js.map