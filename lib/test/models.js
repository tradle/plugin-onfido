"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const models_1 = require("@tradle/models");
const customModels = require("@tradle/custom-models");
const mergeModels = require("@tradle/merge-models");
const models = mergeModels()
    .add(models_1.models)
    .add(customModels)
    .get();
exports.default = models;
//# sourceMappingURL=models.js.map