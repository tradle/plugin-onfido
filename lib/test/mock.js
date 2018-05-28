"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) if (e.indexOf(p[i]) < 0)
            t[p[i]] = s[p[i]];
    return t;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const crypto = require("crypto");
const lodash_1 = __importDefault(require("lodash"));
const constants_1 = require("@tradle/constants");
const models_1 = __importDefault(require("../models"));
const console_logger_1 = __importDefault(require("./console-logger"));
const _1 = require("../");
const utils_1 = require("../utils");
const constants_2 = require("../constants");
const secretStore = () => {
    const kv = keyValueStore();
    return {
        get: ({ key }) => kv.get(key),
        put: ({ key, value }) => kv.put(key, value),
        del: ({ key }) => kv.del(key),
        update: ({ key, value }) => kv.put(key, value)
    };
};
const keyValueStore = () => {
    const store = {};
    return {
        get: (key) => __awaiter(this, void 0, void 0, function* () {
            if (key in store)
                return store[key];
            throw notFoundError(`key ${key} not found`);
        }),
        put: (key, value) => __awaiter(this, void 0, void 0, function* () {
            store[key] = value;
        }),
        del: (key) => __awaiter(this, void 0, void 0, function* () {
            delete store[key];
        }),
        sub: () => keyValueStore()
    };
};
exports.default = {
    client: mockClient,
    api: mockAPI,
    keyValueStore,
    sig: newSig,
    request: mockRequest
};
function mockClient(_a) {
    var { products } = _a, rest = __rest(_a, ["products"]);
    const onfidoAPI = mockAPI();
    const bot = mockBot();
    const plugin = _1.createPlugin(Object.assign({ formsToRequestCorrectionsFor: ['tradle.onfido.Applicant', 'tradle.Selfie'], logger: new console_logger_1.default(), bot,
        onfidoAPI, applications: {
            createVerification: ({ application, verification }) => {
                throw new Error('mock me');
            },
            requestEdit: () => __awaiter(this, void 0, void 0, function* () {
                throw new Error('mock me');
            })
        }, products }, rest));
    plugin.secrets.put({ key: constants_2.DEFAULT_WEBHOOK_KEY, value: { token: 'testtoken' } });
    return plugin;
}
const wrapResource = (resource, bot) => {
    resource = lodash_1.default.cloneDeep(resource);
    if (resource[constants_1.SIG])
        utils_1.addLinks(resource);
    let isModified;
    const wrapper = {
        get(key) {
            return resource[key];
        },
        set(key, value) {
            isModified = true;
            if (typeof key === 'string') {
                resource[key] = value;
            }
            else {
                lodash_1.default.extend(resource, key);
            }
            return this;
        },
        sign() {
            return __awaiter(this, void 0, void 0, function* () {
                resource[constants_1.SIG] = newSig();
                utils_1.addLinks(resource);
                return this;
            });
        },
        save() {
            return __awaiter(this, void 0, void 0, function* () {
                utils_1.addLinks(resource);
                isModified = false;
                yield bot.save(resource);
            });
        },
        signAndSave() {
            return __awaiter(this, void 0, void 0, function* () {
                if (resource[constants_1.SIG]) {
                    resource[constants_1.VERSION] = (resource[constants_1.VERSION] || 0) + 1;
                    resource[constants_1.PERMALINK] = resource._link;
                    resource[constants_1.PERMALINK] = resource._permalink;
                }
                else {
                    resource[constants_1.VERSION] = 0;
                }
                yield wrapper.sign();
                yield wrapper.save();
                return this;
            });
        },
        toJSON(opts) {
            return lodash_1.default.cloneDeep(resource);
        },
        isModified() {
            return isModified;
        }
    };
    return wrapper;
};
function mockBot() {
    const db = {};
    const getKey = resource => {
        const type = resource[constants_1.TYPE];
        const permalink = resource._permalink;
        if (!(type && permalink)) {
            debugger;
            throw new Error(`expected ${constants_1.TYPE} and _permalink`);
        }
        return JSON.stringify({ type, permalink });
    };
    const sign = (resource) => __awaiter(this, void 0, void 0, function* () {
        return Object.assign({}, resource, { [constants_1.SIG]: newSig() });
    });
    const save = (resource) => __awaiter(this, void 0, void 0, function* () {
        db[getKey(resource)] = resource;
    });
    const draft = ({ type, resource = {} }) => wrapResource(Object.assign({ [constants_1.TYPE]: resource[constants_1.TYPE] || type }, resource), bot);
    const dbMock = {
        get: (props) => __awaiter(this, void 0, void 0, function* () {
            const val = db[getKey(props)];
            if (val)
                return val;
            throw notFoundError(`not found: ${JSON.stringify(props)}`);
        }),
        find: ({ filter }) => __awaiter(this, void 0, void 0, function* () {
            const { EQ } = filter;
            const items = [];
            for (let key in db) {
                let item = db[key];
                for (let prop in EQ) {
                    if (lodash_1.default.isEqual(lodash_1.default.get(item, prop), EQ[prop])) {
                        items.push(item);
                    }
                }
            }
            return { items };
        }),
        findOne: (opts) => __awaiter(this, void 0, void 0, function* () {
            const item = (yield dbMock.find(opts)).items[0];
            if (item)
                return item;
            throw notFoundError(`not found: ${JSON.stringify(opts)}`);
        })
    };
    const bot = {
        models: models_1.default,
        resolveEmbeds: () => { },
        draft,
        sign,
        save,
        kv: keyValueStore(),
        conf: keyValueStore(),
        secrets: secretStore(),
        users: {
            get: (id) => __awaiter(this, void 0, void 0, function* () {
                throw new Error('users.get() not mocked');
            })
        },
        db: dbMock
    };
    return bot;
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
        reports: {
        // get: function (id) {
        //   typeforce(typeforce.String, id)
        //   if (report) {
        //     return Promise.resolve(reports.shift())
        //   }
        //   const match = check.reports.find(r => r.id === id)
        //   if (match) Promise.resolve(match)
        //   else Promise.reject(new Error('report not found'))
        // }
        },
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
function notFoundError(message) {
    const err = new Error(message);
    err.name = 'NotFound';
    return err;
}
//# sourceMappingURL=mock.js.map