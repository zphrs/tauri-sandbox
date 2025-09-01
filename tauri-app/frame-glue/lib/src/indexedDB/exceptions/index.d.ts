export declare const ErrorDescriptions: {
    Abort: string;
    Constraint: string;
    DataClone: string;
    Data: string;
    InvalidState: string;
    InvalidAccess: string;
    NotFound: string;
    NotReadable: string;
    QuotaExceeded: string;
    Syntax: string;
    ReadOnly: string;
    TransactionInactive: string;
    Unknown: string;
    Version: string;
};
export declare function createError(type: keyof typeof ErrorDescriptions): DOMException;
