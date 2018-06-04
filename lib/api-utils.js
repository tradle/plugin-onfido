"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const lodash_1 = __importDefault(require("lodash"));
const constants_1 = require("@tradle/constants");
const buildResource = require("@tradle/build-resource");
const utils_1 = require("./utils");
class APIUtils {
    constructor({ logger, bot, onfidoAPI, applications, models }) {
        this.getResource = async (resource, req) => {
            if (resource[constants_1.TYPE])
                return resource;
            const { type, link, permalink } = resource.id ? utils_1.parseStub(resource) : resource;
            if (req) {
                const { payload } = req;
                if (payload && payload._link === link) {
                    return payload;
                }
            }
            const result = await this.db.get({
                [constants_1.TYPE]: type,
                _permalink: permalink
            });
            await this.bot.resolveEmbeds(result);
            return result;
        };
        this.getUser = async (permalink, req) => {
            if (req) {
                const { user } = req;
                if (user && user.id === permalink) {
                    return user;
                }
            }
            return await this.bot.users.get(permalink);
        };
        this.checkAddress = async ({ address }) => {
            if (address.country !== 'GBR') {
                this.logger.debug('can only check address validity for UK addresses');
                return;
            }
            let validAddresses = [];
            try {
                const result = await this.onfidoAPI.misc.getAddressesForPostcode({
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
        };
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
        this.toStableStub = stub => lodash_1.default.omit(stub, '_displayName');
        this.sanitize = obj => utils_1.sanitize(obj).sanitized;
        this.logger = logger;
        this.onfidoAPI = onfidoAPI;
        this.applications = applications;
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