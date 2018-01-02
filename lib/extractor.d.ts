import { OnfidoAddress } from './types';
declare const _default: {
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
        [APPLICANT]: (form: any) => string;
    };
};
export default _default;
