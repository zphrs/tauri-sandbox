import { FDBKeyRange } from "../inMemoryIdb"

export type SerializedQuery =
    | IDBValidKey
    | {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          lower: any
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          upper: any
          lowerOpen?: boolean
          upperOpen?: boolean
      }

export function deserializeQuery(
    range: SerializedQuery,
): IDBValidKey | IDBKeyRange | undefined {
    if (typeof range === "object" && "lower" in range) {
        const { lower, upper, lowerOpen, upperOpen } = range
        if (lower === undefined && upper === undefined) return undefined
        if (lower === undefined) {
            return IDBKeyRange.upperBound(upper, upperOpen)
        }
        if (upper === undefined) {
            return IDBKeyRange.lowerBound(lower, lowerOpen)
        }
        return IDBKeyRange.bound(lower, upper, lowerOpen, upperOpen)
    }
    return range
}

export function serializeQuery<T extends IDBValidKey | IDBKeyRange | undefined>(
    range: T,
): T extends undefined ? SerializedQuery | undefined : SerializedQuery {
    if (range === undefined)
        return undefined as T extends undefined
            ? SerializedQuery | undefined
            : SerializedQuery
    if (typeof range === "object" && range instanceof FDBKeyRange) {
        return {
            lower: range.lower,
            upper: range.upper,
            lowerOpen: range.lowerOpen,
            upperOpen: range.upperOpen,
        }
    }
    return range
}
