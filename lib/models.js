"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const models_1 = require("@tradle/models");
const customModels = require("@tradle/custom-models");
const mergeModels = require("@tradle/merge-models");
const onfido_models_1 = require("./onfido-models");
const models = mergeModels()
    .add(models_1.models, { validate: false })
    .add(customModels, { validate: false })
    .add(onfido_models_1.default.all)
    .get();
exports.default = models;
//# sourceMappingURL=models.js.map