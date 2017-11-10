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
const crypto = require("crypto");
const constants_1 = require("@tradle/constants");
const buildResource = require("@tradle/build-resource");
const _1 = require("../");
const models_1 = require("../models");
const console_logger_1 = require("./console-logger");
const utils_1 = require("../utils");
const constants_2 = require("../constants");
const keyValueStore = () => {
    const store = {};
    return {
        get: (key) => __awaiter(this, void 0, void 0, function* () {
            if (key in store)
                return store[key];
            debugger;
            throw new Error(`key ${key} not found`);
        }),
        put: (key, value) => __awaiter(this, void 0, void 0, function* () {
            store[key] = value;
        })
    };
};
exports.default = {
    client: mockClient,
    api: mockAPI,
    keyValueStore,
    sig: newSig,
    request: mockRequest
};
function mockClient(opts) {
    const onfidoAPI = mockAPI();
    const bot = mockBot();
    return _1.default({
        logger: new console_logger_1.default(),
        onfidoAPI,
        productsAPI: {
            models: {
                all: models_1.default
            },
            importVerification: (verification) => {
                throw new Error('mock me');
            },
            bot,
            saveNewVersionOfApplication: ({ application }) => __awaiter(this, void 0, void 0, function* () {
                return yield bot.versionAndSave(application);
            })
        }
    });
}
function mockBot() {
    const db = {};
    const getKey = resource => {
        const type = resource[constants_1.TYPE];
        const permalink = resource._permalink;
        if (!(type && permalink)) {
            throw new Error(`expected ${constants_1.TYPE} and _permalink`);
        }
        return JSON.stringify({ type, permalink });
    };
    const sign = (resource) => __awaiter(this, void 0, void 0, function* () {
        resource[constants_1.SIG] = newSig();
        return resource;
    });
    const save = (resource) => __awaiter(this, void 0, void 0, function* () {
        db[getKey(resource)] = resource;
    });
    const signAndSave = (resource) => __awaiter(this, void 0, void 0, function* () {
        yield sign(resource);
        utils_1.addLinks(resource);
        yield save(resource);
        return resource;
    });
    const version = (resource) => __awaiter(this, void 0, void 0, function* () {
        buildResource.version(resource);
        return sign(resource);
    });
    const versionAndSave = (resource) => __awaiter(this, void 0, void 0, function* () {
        const ver = yield version(resource);
        yield save(ver);
        return ver;
    });
    return {
        sign,
        save,
        signAndSave,
        version,
        versionAndSave,
        kv: keyValueStore(),
        conf: (function () {
            const store = keyValueStore();
            store.put(constants_2.DEFAULT_WEBHOOK_KEY, { token: 'testtoken' });
            return store;
        })(),
        db: {
            get: (props) => __awaiter(this, void 0, void 0, function* () {
                const val = db[getKey(props)];
                if (val)
                    return val;
                throw new Error(`not found: ${JSON.stringify(props)}`);
            })
        }
    };
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
function newSig() {
    return crypto.randomBytes(128).toString('base64');
}
function mockRequest() {
    return {
        get: prop => `mock value for ${prop}`,
        originalUrl: 'mock original url'
    };
}
//# sourceMappingURL=mock.js.map