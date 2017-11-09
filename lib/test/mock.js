"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const _1 = require("../");
const models_1 = require("./models");
const console_logger_1 = require("./console-logger");
exports.default = {
    client: mockClient,
    api: mockAPI
};
function mockClient(opts) {
    const onfidoAPI = mockAPI(opts);
    return _1.default({
        logger: new console_logger_1.default(),
        onfidoAPI,
        productsAPI: {
            models: {
                all: models_1.default
            },
            bot: {
                db: {
                    get: () => {
                        throw new Error('not found');
                    }
                }
            }
        }
    });
}
function mockAPI() {
    return {
        applicants: {
            get: (id) => __awaiter(this, void 0, void 0, function* () {
                throw new Error('mock me');
            }),
            create: (obj) => __awaiter(this, void 0, void 0, function* () {
                throw new Error('mock me');
            }),
            update: (id, obj) => __awaiter(this, void 0, void 0, function* () {
                throw new Error('mock me');
            }),
            uploadDocument: (id, obj) => __awaiter(this, void 0, void 0, function* () {
                throw new Error('mock me');
            }),
            uploadLivePhoto: (id, obj) => __awaiter(this, void 0, void 0, function* () {
                throw new Error('mock me');
            })
        },
        checks: {
            get: (opts) => __awaiter(this, void 0, void 0, function* () {
                throw new Error('mock me');
            }),
            create: (id, opts) => __awaiter(this, void 0, void 0, function* () {
                throw new Error('mock me');
            }),
            createDocumentCheck: (id) => __awaiter(this, void 0, void 0, function* () {
                throw new Error('mock me');
            })
        },
        reports: {},
        webhooks: {
            handleEvent: (req) => {
                return new Promise((resolve, reject) => {
                    let body;
                    req
                        .on('data', data => body += data.toString())
                        .on('end', () => resolve(JSON.parse(body).payload))
                        .on('error', reject);
                });
            }
        },
        misc: {
            getAddressesForPostcode: () => __awaiter(this, void 0, void 0, function* () {
                throw new Error('mock me');
            })
        }
    };
}
//# sourceMappingURL=mock.js.map