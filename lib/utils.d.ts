import { ApplicantProps, ProductOptions } from './types';
declare const sanitize: any;
export { sanitize };
export declare const getLatestFormByType: (application: any, type: string) => any;
export declare const getLatestForm: (application: any, filter: Function) => any;
export declare const parseStub: any;
export declare const getPhotoID: (application: any) => any;
export declare const getSelfie: (application: any) => any;
export declare const firstProp: (obj: any) => string;
export declare const parseReportURL: (url: any) => {
    checkId: any;
    reportId: any;
};
export declare const parseCheckURL: (url: any) => {
    applicantId: any;
    checkId: any;
};
export declare const getOnfidoCheckIdKey: (checkId: any) => string;
export declare const getFormsToCreateApplicant: ({ forms, reports }: {
    forms: any;
    reports: any;
}) => any[];
export declare const unique: (arr: any) => any[];
export declare const isApplicantInfoForm: (type: any) => boolean;
export declare const getApplicantProps: (forms: any) => ApplicantProps;
export declare const normalizeDate: (date: any) => string;
export declare const toYYYY_MM_DD_UTC: (date: any, separator: any) => string;
export declare const find: (arr: any, filter: any) => any;
export declare const equalish: (a: any, b: any) => boolean;
export declare const stringifyAndNormalize: (val: any) => string;
export declare const getExtension: (mimeType: any) => any;
export declare const digest: (data: any) => string;
export declare const hasTwoSides: (onfidoType: any) => boolean;
export declare const pickNonNull: (obj: any) => {};
export declare const ensureNoPendingCheck: (state: any) => void;
export declare const getEnumValueId: (value: any) => any;
export declare const getCompletedReports: ({ current, update }: {
    current: any;
    update: any;
}) => any;
export declare const createOnfidoVerification: ({ applicant, form, report }: {
    applicant: any;
    form: any;
    report: any;
}) => any;
export declare const isComplete: (onfidoObject: any) => boolean;
export declare const addLinks: (resource: any) => void;
export declare const batchify: (arr: any, batchSize: any) => any[];
export declare const stubFromParsedStub: (parsedStub: any) => any;
export declare const validateProductOptions: (opts: ProductOptions) => void;
