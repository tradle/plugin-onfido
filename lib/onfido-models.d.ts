declare const models: {
    reportStatus: {
        type: string;
        id: string;
        subClassOf: string;
        title: string;
        description: string;
        properties: {
            status: {
                type: string;
            };
        };
        enum: {
            id: string;
            title: string;
        }[];
    };
    checkStatus: {
        type: string;
        id: string;
        subClassOf: string;
        title: string;
        description: string;
        properties: {
            status: {
                type: string;
            };
        };
        enum: {
            id: string;
            title: string;
        }[];
    };
    opResult: {
        type: string;
        id: string;
        subClassOf: string;
        title: string;
        description: string;
        properties: {
            result: {
                type: string;
            };
        };
        enum: {
            id: string;
            title: string;
        }[];
    };
    reportType: {
        type: string;
        id: string;
        subClassOf: string;
        title: string;
        properties: {
            type: {
                type: string;
            };
        };
        enum: {
            id: string;
            title: string;
        }[];
    };
    check: {
        type: string;
        id: string;
        title: string;
        properties: {
            rawData: {
                type: string;
                range: string;
            };
            reportsOrdered: {
                type: string;
                inlined: boolean;
                items: {
                    ref: string;
                };
            };
            status: {
                type: string;
                ref: string;
            };
            result: {
                type: string;
                ref: string;
            };
            applicantId: {
                type: string;
            };
            checkId: {
                type: string;
            };
        };
    };
    state: {
        type: string;
        id: string;
        title: string;
        properties: {
            applicant: {
                type: string;
                ref: string;
            };
            application: {
                type: string;
                ref: string;
            };
            onfidoApplicant: {
                type: string;
                range: string;
            };
            selfie: {
                type: string;
                ref: string;
            };
            photoID: {
                type: string;
                ref: string;
            };
            applicantDetails: {
                type: string;
                items: {
                    ref: string;
                };
            };
            check: {
                type: string;
                ref: string;
            };
            checkStatus: {
                type: string;
                ref: string;
            };
            errors: {
                type: string;
                range: string;
            };
            result: {
                type: string;
                ref: string;
            };
        };
    };
    stateStub: {
        type: string;
        id: string;
        title: string;
        inlined: boolean;
        properties: {
            application: {
                type: string;
                ref: string;
            };
            state: {
                type: string;
                ref: string;
            };
        };
    };
    all: {};
};
export default models;
