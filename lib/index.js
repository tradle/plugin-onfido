"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const plugin_1 = __importDefault(require("./plugin"));
exports.Onfido = plugin_1.default;
const createPlugin = (opts) => new plugin_1.default(opts);
exports.createPlugin = createPlugin;
//# sourceMappingURL=index.js.map