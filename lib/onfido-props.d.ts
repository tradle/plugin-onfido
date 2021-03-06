import { APPLICANT, SELFIE, PHOTO_ID, EMAIL_ADDRESS } from './constants';
declare const byForm: {
    [APPLICANT]: {
        building_number: {
            tradle: string;
            error: string;
        };
        flat_number: {
            tradle: string;
            error: string;
        };
        street: {
            tradle: string;
            error: string;
        };
        sub_street: {
            tradle: string;
            error: string;
        };
        town: {
            tradle: string;
            error: string;
        };
        postcode: {
            tradle: string;
            error: string;
        };
        first_name: {
            tradle: string;
            error: string;
        };
        last_name: {
            tradle: string;
            error: string;
        };
        dob: {
            tradle: string;
            error: string;
        };
        country: {
            tradle: string;
            transform: (country: any) => "GBR" | "NZL";
        };
    };
    [SELFIE]: {
        face_detection: {
            tradle: string;
            error: string;
        };
    };
    [PHOTO_ID]: {
        document: {
            tradle: string;
            error: string;
        };
    };
    [EMAIL_ADDRESS]: {
        email: {
            tradle: string;
            error: string;
        };
    };
};
export default byForm;
