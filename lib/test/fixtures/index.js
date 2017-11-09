"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const parseDataUri = require("parse-data-uri");
const applicants = require("./applicants");
const checks = require("./checks");
const documents = require("./documents");
const documentImages = require("./document-images");
const tradle = require("./tradle");
const inputs = require("./inputs");
inputs.license.file = parseDataUri(inputs.license.file).data;
inputs.selfie.file = parseDataUri(inputs.selfie.file).data;
exports.default = {
    applicants,
    checks,
    documents,
    documentImages,
    tradle,
    inputs
};
//# sourceMappingURL=index.js.map