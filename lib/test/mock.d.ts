import { Onfido } from '../';
declare const _default: {
    client: (opts?: {}) => Onfido;
    api: () => {
        applicants: {
            get: (id: any) => Promise<never>;
            create: (obj: any) => Promise<never>;
            update: (id: any, obj: any) => Promise<never>;
            uploadDocument: (id: any, obj: any) => Promise<never>;
            uploadLivePhoto: (id: any, obj: any) => Promise<never>;
        };
        checks: {
            get: (opts: any) => Promise<never>;
            create: (id: any, opts: any) => Promise<never>;
            createDocumentCheck: (id: any) => Promise<never>;
        };
        reports: {};
        webhooks: {
            handleEvent: (req: any) => Promise<{}>;
        };
        misc: {
            getAddressesForPostcode: () => Promise<never>;
        };
    };
    keyValueStore: () => {
        get: (key: any) => Promise<any>;
        put: (key: any, value: any) => Promise<void>;
    };
    sig: () => string;
    request: () => {
        get: (prop: any) => string;
        originalUrl: string;
    };
};
export default _default;
