export const ErrorDescriptions = {
    Abort: "A request was aborted.",
    Constraint:
        "A mutation operation in the transaction failed because a constraint was not satisfied.",
    DataClone:
        "The data being stored could not be cloned by the internal structured cloning algorithm.",
    Data: "Data provided to an operation does not meet requirements.",
    InvalidState: "The object is in an invalid state.",
    InvalidAccess: "An invalid operation was performed on an object.",
    NotFound:
        "The operation failed because the requested database object could not be found.",
    NotReadable:
        "The operation failed because the underlying storage containing the requested data could not be read.",
    QuotaExceeded:
        "The operation failed because there was not enough remaining storage space, or the storage quota was reached and the user declined to give more space to the database.",
    Syntax: "The keyPath argument contains an invalid key path.",
    ReadOnly:
        "The mutating operation was attempted in a read-only transaction.",
    TransactionInactive:
        "A request was placed against a transaction which is currently not active, or which is finished.",
    Unknown:
        "The operation failed for transient reasons unrelated to the database itself or not covered by any other error.",
    Version:
        "An attempt was made to open a database using a lower version than the existing version.",
}

export function createError(type: keyof typeof ErrorDescriptions) {
    return new DOMException(ErrorDescriptions[type], `${type}Error`)
}
