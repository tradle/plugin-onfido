import { OnfidoAddress } from './types';
export declare const byProp: {
    name: {
        [NAME]: (name: any) => {
            first_name: any;
            last_name: any;
        };
        [APPLICANT]: (name: any) => {
            first_name: any;
            last_name: any;
        };
    };
    address: {
        [APPLICANT]: (form: any) => OnfidoAddress;
        [ADDRESS]: (form: any) => OnfidoAddress;
    };
    dob: {
        [APPLICANT]: (form: any) => string | void;
    };
};
export declare const byForm: any;
export declare const getExtractor: (field: string, fromFormType: string) => void | Function;
export declare const canExtract: (field: string, fromFormType: string) => boolean;
export declare const extract: (field: any, fromFormType: any, form: any) => any;
export declare const hasField: (field: string) => boolean;
export declare const hasForm: (formType: string) => boolean;
