import { APPLICANT, SELFIE, PHOTO_ID, EMAIL_ADDRESS, NAME } from './constants';
declare const byForm: {
    [NAME]: {
        first_name: {
            tradle: string;
        };
        last_name: {
            tradle: string;
        };
    };
    [APPLICANT]: {
        building_number: {
            tradle: string;
        };
        flat_number: {
            tradle: string;
        };
        street: {
            tradle: string;
        };
        sub_street: {
            tradle: string;
        };
        town: {
            tradle: string;
        };
        postcode: {
            tradle: string;
        };
        first_name: {
            tradle: string;
        };
        last_name: {
            tradle: string;
        };
        dob: {
            tradle: string;
        };
        country: {
            tradle: string;
            transform: (country: any) => "GBR" | "NZL";
        };
    };
    [SELFIE]: {
        face_detection: {
            tradle: string;
        };
    };
    [PHOTO_ID]: {
        document: {
            tradle: string;
        };
    };
    [EMAIL_ADDRESS]: {
        email: {
            tradle: string;
        };
    };
};
export default byForm;
