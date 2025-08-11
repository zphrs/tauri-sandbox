export type SerializedQuery =
    | IDBValidKey
    | {
          lower: any
          upper: any
          lowerOpen?: boolean
          upperOpen?: boolean
      }

export function deserializeQuery(
    range: SerializedQuery
): IDBValidKey | IDBKeyRange {
    if (typeof range === "object" && "lower" in range) {
        const { lower, upper, lowerOpen, upperOpen } = range
        return IDBKeyRange.bound(lower, upper, lowerOpen, upperOpen)
    }
    return range
}

export function serializeQuery<T extends IDBValidKey | IDBKeyRange | undefined>(
    range: T
): T extends undefined ? SerializedQuery | undefined : SerializedQuery {
    if (range === undefined)
        return undefined as T extends undefined
            ? SerializedQuery | undefined
            : SerializedQuery
    if (typeof range === "object" && "lower" in range) {
        return {
            lower: range.lower,
            upper: range.upper,
            lowerOpen: range.lowerOpen,
            upperOpen: range.upperOpen,
        }
    }
    return range
}
