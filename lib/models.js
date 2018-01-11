"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const models_1 = require("@tradle/models");
const customModels = require('@tradle/custom-models');
const productsBotModels = require('@tradle/models-products-bot');
const onfidoModels = require('@tradle/models-onfido');
const models = Object.assign({}, models_1.models, customModels, productsBotModels, onfidoModels);
exports.default = models;
//# sourceMappingURL=models.js.map