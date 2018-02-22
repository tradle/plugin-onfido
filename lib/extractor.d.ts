import { NAME, APPLICANT, ADDRESS, PG_PERSONAL_DETAILS } from './constants';
import { OnfidoAddress } from './types';
export declare const byProp: {
    name: {
        [NAME]: (form: any) => any;
        [APPLICANT]: (form: any) => any;
        [PG_PERSONAL_DETAILS]: (form: any) => any;
    };
    address: {
        [APPLICANT]: (form: any) => void | OnfidoAddress;
        [ADDRESS]: (form: any) => void | OnfidoAddress;
    };
    dob: {
        [APPLICANT]: (form: any) => string | void;
        [PG_PERSONAL_DETAILS]: (form: any) => string | void;
    };
};
export declare const byForm: any;
export declare const getExtractor: (field: string, fromFormType: string) => void | Function;
export declare const canExtract: (field: string, fromFormType: string) => boolean;
export declare const extract: (field: any, fromFormType: any, form: any) => any;
export declare const hasField: (field: string) => boolean;
export declare const hasForm: (formType: string) => boolean;
