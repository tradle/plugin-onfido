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
const constants_1 = require("@tradle/constants");
const buildResource = require("@tradle/build-resource");
const utils_1 = require("./utils");
class APIUtils {
    constructor({ logger, bot, onfidoAPI, productsAPI, models }) {
        this.getResource = (resource, req) => __awaiter(this, void 0, void 0, function* () {
            if (resource[constants_1.TYPE])
                return resource;
            const { type, link, permalink } = resource.id ? utils_1.parseStub(resource) : resource;
            if (req) {
                const { payload } = req;
                if (payload && payload._link === link) {
                    return payload;
                }
            }
            const result = yield this.db.get({
                [constants_1.TYPE]: type,
                _permalink: permalink
            });
            yield this.bot.resolveEmbeds(result);
            return result;
        });
        this.getUser = (permalink, req) => __awaiter(this, void 0, void 0, function* () {
            if (req) {
                const { user } = req;
                if (user && user.id === permalink) {
                    return user;
                }
            }
            return yield this.bot.users.get(permalink);
        });
        this.checkAddress = ({ address }) => __awaiter(this, void 0, void 0, function* () {
            if (address.country !== 'GBR') {
                this.logger.debug('can only check address validity for UK addresses');
                return;
            }
            let validAddresses = [];
            try {
                const result = yield this.onfidoAPI.misc.getAddressesForPostcode({
                    postcode: address.postcode
                });
                validAddresses = result.addresses;
            }
            catch (err) {
                this.logger.error('failed to access Onfido Address Picker', err);
                return false;
            }
            const closestMatch = validAddresses.find(valid => {
                for (let p in valid) {
                    let val = valid[p];
                    if (val != null && address[p] != null) {
                        if (!utils_1.equalish(val, address[p]))
                            return false;
                    }
                }
                return true;
            });
            if (!closestMatch) {
                this.logger.info(`no valid address found to match applicants: ${JSON.stringify(address)}`);
                return false;
            }
            return true;
        });
        this.stub = (resource) => {
            return buildResource.stub({
                models: this.models,
                resource
            });
        };
        this.setProps = (resource, properties) => {
            buildResource.set({
                models: this.models,
                resource,
                properties
            });
        };
        this.logger = logger;
        this.onfidoAPI = onfidoAPI;
        this.productsAPI = productsAPI;
        this.bot = bot;
        this.db = bot.db;
        this.models = models;
    }
    isTestMode() {
        return this.onfidoAPI.mode === 'test';
    }
}
exports.default = APIUtils;
//# sourceMappingURL=api-utils.js.map