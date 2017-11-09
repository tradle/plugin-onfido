declare const models: {
    opStatus: {
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
            reportsOrdered: {
                type: string;
                inlined: boolean;
                items: {
                    ref: string;
                };
            };
            reportsResults: {
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
            status: {
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
            pendingCheck: {
                type: string;
                ref: string;
            };
            pendingCheckStatus: {
                type: string;
                ref: string;
            };
            errors: {
                type: string;
                items: {
                    type: string;
                    range: string;
                };
            };
            result: {
                type: string;
                range: string;
                description: string;
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
