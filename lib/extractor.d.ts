import { OnfidoAddress } from './types';
declare const _default: {
    name: {
        [x: string]: (name: any) => {
            first_name: any;
            last_name: any;
        };
    };
    address: {
        [x: string]: (form: any) => OnfidoAddress;
    };
    dob: {
        [x: string]: (form: any) => string;
    };
};
export default _default;
