import {
    FDBCursorWithValue,
    FDBIndex,
    FDBKeyRange,
    FDBObjectStore,
    FDBRequest,
} from "."
import { call } from "../../rpcOverPorts"
import type { GetNextFromCursorMethod } from "../methods/readFromStore"
import { serializeQuery } from "../methods/SerializedRange"

import { cmp } from "./lib/cmp"
import {
    DataError,
    InvalidAccessError,
    InvalidStateError,
    ReadOnlyError,
    TransactionInactiveError,
} from "./lib/errors"
import extractKey from "./lib/extractKey"
import type {
    CursorRange,
    CursorSource,
    FDBCursorDirection,
    Key,
    Value,
    Record,
} from "./lib/types"
import valueToKey from "./lib/valueToKey"

const getEffectiveObjectStore = (cursor: FDBCursor) => {
    if (cursor.source instanceof FDBObjectStore) {
        return cursor.source
    }
    return cursor.source.objectStore
}

// This takes a key range, a list of lower bounds, and a list of upper bounds and combines them all into a single key
// range. It does not handle gt/gte distinctions, because it doesn't really matter much anyway, since for next/prev
// cursor iteration it'd also have to look at values to be precise, which would be complicated. This should get us 99%
// of the way there.
const makeKeyRange = (
    range: FDBKeyRange | IDBValidKey | undefined,
    lowers: (Key | undefined)[],
    uppers: (Key | undefined)[],
) => {
    // Start with bounds from range
    let [lower, upper] =
        typeof range === "object" && "lower" in range
            ? [range?.lower, range?.upper]
            : [undefined, undefined]

    // Augment with values from lowers and uppers
    for (const lowerTemp of lowers) {
        if (lowerTemp === undefined) {
            continue
        }

        if (lower === undefined || cmp(lower, lowerTemp) === 1) {
            lower = lowerTemp
        }
    }
    for (const upperTemp of uppers) {
        if (upperTemp === undefined) {
            continue
        }

        if (upper === undefined || cmp(upper, upperTemp) === -1) {
            upper = upperTemp
        }
    }

    if (lower !== undefined && upper !== undefined) {
        return FDBKeyRange.bound(lower, upper)
    }
    if (lower !== undefined) {
        return FDBKeyRange.lowerBound(lower)
    }
    if (upper !== undefined) {
        return FDBKeyRange.upperBound(upper)
    }
}

export async function getValueIterator() {}

// http://www.w3.org/TR/2015/REC-IndexedDB-20150108/#cursor
class FDBCursor {
    public _request: FDBRequest | undefined

    private _gotValue: boolean = false
    private _range: CursorRange
    private _position: IDBValidKey | undefined = undefined // Key of previously returned record
    private _objectStorePosition: IDBValidKey | undefined = undefined

    private _source: CursorSource
    private _direction: FDBCursorDirection
    private _key: IDBValidKey | undefined = undefined
    private _primaryKey: Key | undefined = undefined
    private _previousFetchedPrimaryKey: Key | undefined = undefined
    private _previousFetchedKey: Key | undefined = undefined

    constructor(
        source: CursorSource,
        range: CursorRange,
        direction: FDBCursorDirection = "next",
        request?: FDBRequest,
    ) {
        this._range = range
        this._source = source
        this._direction = direction
        this._request = request
    }

    // Read only properties
    get source() {
        return this._source
    }
    set source(_val) {
        /* For babel */
    }

    get request() {
        return this._request
    }
    set request(_val) {
        /* For babel */
    }

    get direction() {
        return this._direction
    }
    set direction(_val) {
        /* For babel */
    }

    get key() {
        return this._key
    }
    set key(_val) {
        /* For babel */
    }

    get primaryKey() {
        return this._primaryKey
    }
    set primaryKey(_val) {
        /* For babel */
    }

    // https://w3c.github.io/IndexedDB/#iterate-a-cursor
    public async _iterate(key?: Key, primaryKey?: Key): Promise<this | null> {
        // if (this._range === undefined) throw new InvalidStateError()
        const sourceIsObjectStore = this.source instanceof FDBObjectStore

        // Can't use sourceIsObjectStore because TypeScript
        const records =
            this.source instanceof FDBObjectStore
                ? this.source._rawObjectStore.records
                : this.source._rawIndex.records
        const objectStore =
            this.source instanceof FDBIndex
                ? this.source._rawIndex.rawObjectStore
                : this.source._rawObjectStore
        const storeName: string = objectStore.name
        const port: MessagePort = objectStore.rawDatabase._port
        let foundRecord: Record | undefined
        const isNext = this.direction.includes("next")
        const isUnique = this.direction.includes("unique")
        const range = makeKeyRange(
            this._range,
            isNext ? [key, this._position] : [],
            isNext ? [] : [key, this._position],
        )
        if (range && this._range?.lowerOpen) {
            range.lowerOpen = true
        }
        if (range && this._range?.upperOpen) {
            range.upperOpen = true
        }
        if (
            (isUnique || sourceIsObjectStore) &&
            range &&
            isNext &&
            this._range?.lower !== range?.lower
        ) {
            range.lowerOpen = true
        }

        if (
            (isUnique || sourceIsObjectStore) &&
            range &&
            !isNext &&
            this._range?.upper !== range?.upper
        ) {
            range.upperOpen = true
        }
        const fetchedNextPromise = call<GetNextFromCursorMethod>(
            port,
            "executeReadMethod",
            {
                dbName: objectStore.rawDatabase.name,
                store: storeName,
                call: {
                    method: "getNextFromCursor",
                    params: {
                        range: serializeQuery(range),
                        direction: this.direction,
                        prevPrimaryKey:
                            range &&
                            this._previousFetchedKey &&
                            range.includes(this._previousFetchedKey)
                                ? this._previousFetchedPrimaryKey
                                : undefined,
                        indexName: sourceIsObjectStore
                            ? undefined
                            : this.source.name,
                    },
                },
            },
        )

        const iterationDirection = isNext ? undefined : "prev"
        let tempRecord: Record | undefined

        for (const record of records.values(range, iterationDirection)) {
            const cmpResultKey =
                key !== undefined ? cmp(record.key, key) : undefined
            const cmpResultPosition =
                this._position !== undefined
                    ? cmp(record.key, this._position)
                    : undefined

            // Key comparison checks
            if (key !== undefined) {
                if (
                    (isNext && cmpResultKey === -1) ||
                    (!isNext && cmpResultKey === 1)
                ) {
                    continue
                }
            }

            // Primary key comparison for continuePrimaryKey
            if (primaryKey !== undefined) {
                if (
                    (isNext && cmpResultKey === -1) ||
                    (!isNext && cmpResultKey === 1)
                ) {
                    continue
                }
                const cmpResultPrimaryKey = cmp(record.value, primaryKey)
                if (cmpResultKey === 0) {
                    if (
                        (isNext && cmpResultPrimaryKey === -1) ||
                        (!isNext && cmpResultPrimaryKey === 1)
                    ) {
                        continue
                    }
                }
            }

            // Position comparison
            if (this._position !== undefined) {
                if (sourceIsObjectStore) {
                    if (
                        (isNext && cmpResultPosition !== 1) ||
                        (!isNext && cmpResultPosition !== -1)
                    ) {
                        continue
                    }
                } else {
                    if (
                        (isNext && cmpResultPosition === -1) ||
                        (!isNext && cmpResultPosition === 1)
                    ) {
                        continue
                    }
                    if (cmpResultPosition === 0) {
                        const objStoreCmp = cmp(
                            record.value,
                            this._objectStorePosition,
                        )
                        if (
                            (isNext && objStoreCmp !== 1) ||
                            (!isNext && objStoreCmp !== -1)
                        ) {
                            continue
                        }
                    }
                }
            }

            // For unique directions, position check is different
            if (isUnique && this._position !== undefined) {
                const expectedCmp = isNext ? 1 : -1
                if (cmpResultPosition !== expectedCmp) {
                    continue
                }
            }

            // Range check
            if (
                this._range !== undefined &&
                !this._range.includes(record.key)
            ) {
                continue
            }

            tempRecord = record
            break
        }

        // For prevunique, get the actual record by key
        if (this.direction === "prevunique" && tempRecord) {
            foundRecord = records.get(tempRecord.key)
        } else {
            foundRecord = tempRecord
        }

        const fetchedNext = await fetchedNextPromise

        console.log({ fetchedNext, foundRecord })

        // Compare local foundRecord with remote fetchedNext to determine which to use
        const convertedFetchedNext =
            fetchedNext &&
            (sourceIsObjectStore
                ? { key: fetchedNext.key, value: fetchedNext.value }
                : { key: fetchedNext.key, value: fetchedNext.primaryKey })
        if (foundRecord && fetchedNext) {
            const cmpResult = cmp(
                sourceIsObjectStore
                    ? foundRecord.key
                    : [foundRecord.key, foundRecord.value],
                sourceIsObjectStore
                    ? fetchedNext.key
                    : [fetchedNext.key, fetchedNext.primaryKey],
            )
            if (isNext) {
                // For next direction, use the smaller key
                if (cmpResult > 0) {
                    foundRecord = convertedFetchedNext
                } else {
                    // if same, fall back to primaryKey ordering
                    const foundPrimaryKey: Key = sourceIsObjectStore
                        ? foundRecord.key
                        : (foundRecord.value as Key)

                    const fetchedPrimaryKey = fetchedNext.primaryKey

                    if (cmp(foundPrimaryKey, fetchedPrimaryKey) > 0) {
                        foundRecord = convertedFetchedNext
                    }
                }
            } else {
                // For prev direction, use the larger key
                if (cmpResult < 0) {
                    foundRecord = convertedFetchedNext
                } else {
                    // if same, fall back to primaryKey ordering
                    const foundPrimaryKey: Key = sourceIsObjectStore
                        ? foundRecord.key
                        : (foundRecord.value as Key)

                    const fetchedPrimaryKey = fetchedNext.primaryKey

                    if (cmp(foundPrimaryKey, fetchedPrimaryKey) < 0) {
                        foundRecord = convertedFetchedNext
                    }
                }
            }
            // either way, default to the foundRecord if the two keys are identical
        } else if (fetchedNext) {
            // If we only have fetchedNext, use it
            foundRecord = convertedFetchedNext
        }

        const fetchedChosen = convertedFetchedNext === foundRecord

        if (foundRecord !== undefined && fetchedChosen) {
            this._previousFetchedPrimaryKey = fetchedNext!.primaryKey as Key
            this._previousFetchedKey = fetchedNext!.key
        }

        let result
        if (!foundRecord) {
            this._key = undefined
            if (!sourceIsObjectStore) {
                this._objectStorePosition = undefined
            }

            if (this instanceof FDBCursorWithValue) {
                this.value = undefined
            }
            result = null
        } else {
            this._position = foundRecord.key
            if (!sourceIsObjectStore) {
                this._objectStorePosition = foundRecord.value as IDBValidKey
            }
            this._key = foundRecord.key
            if (sourceIsObjectStore) {
                this._primaryKey = structuredClone(foundRecord.key)
                if (this instanceof FDBCursorWithValue) {
                    this.value = structuredClone(foundRecord.value)
                }
            } else {
                this._primaryKey = structuredClone(foundRecord.value as Key)
                if (this instanceof FDBCursorWithValue) {
                    if (this.source instanceof FDBObjectStore) {
                        // Can't use sourceIsObjectStore because TypeScript
                        throw new Error("This should never happen")
                    }
                    const value =
                        await this.source.objectStore._rawObjectStore.getValue(
                            foundRecord.value as Key,
                        )
                    ;(this as unknown as FDBCursorWithValue).value =
                        structuredClone(value)
                }
            }
            this._gotValue = true
            // eslint-disable-next-line @typescript-eslint/no-this-alias
            result = this
        }

        return result
    }

    // http://www.w3.org/TR/2015/REC-IndexedDB-20150108/#widl-IDBCursor-update-IDBRequest-any-value
    public update(value: Value) {
        if (value === undefined) {
            throw new TypeError()
        }

        const effectiveObjectStore = getEffectiveObjectStore(this)
        const effectiveKey = Object.hasOwn(this.source, "_rawIndex")
            ? this.primaryKey
            : this._position
        const transaction = effectiveObjectStore.transaction

        if (transaction._state !== "active") {
            throw new TransactionInactiveError()
        }

        if (transaction.mode === "readonly") {
            throw new ReadOnlyError()
        }

        if (effectiveObjectStore._rawObjectStore.deleted) {
            throw new InvalidStateError()
        }
        if (
            !(this.source instanceof FDBObjectStore) &&
            this.source._rawIndex.deleted
        ) {
            throw new InvalidStateError()
        }

        if (!this._gotValue || !Object.hasOwn(this, "value")) {
            throw new InvalidStateError()
        }

        const clone = structuredClone(value)

        if (effectiveObjectStore.keyPath !== null) {
            let tempKey

            try {
                tempKey = extractKey(effectiveObjectStore.keyPath, clone).key
            } catch {
                /* Handled immediately below */
            }

            if (cmp(tempKey, effectiveKey) !== 0) {
                throw new DataError()
            }
        }

        const record = {
            key: effectiveKey as Key,
            value: clone,
        }

        return transaction._execRequestAsync({
            operation: effectiveObjectStore._rawObjectStore.storeRecord.bind(
                effectiveObjectStore._rawObjectStore,
                record,
                false,
                transaction._rollbackLog,
            ),
            source: this,
        })
    }

    // http://www.w3.org/TR/2015/REC-IndexedDB-20150108/#widl-IDBCursor-advance-void-unsigned-long-count
    public advance(count: number) {
        if (!Number.isInteger(count) || count <= 0) {
            throw new TypeError()
        }

        const effectiveObjectStore = getEffectiveObjectStore(this)
        const transaction = effectiveObjectStore.transaction

        if (transaction._state !== "active") {
            throw new TransactionInactiveError()
        }

        if (effectiveObjectStore._rawObjectStore.deleted) {
            throw new InvalidStateError()
        }
        if (
            !(this.source instanceof FDBObjectStore) &&
            this.source._rawIndex.deleted
        ) {
            throw new InvalidStateError()
        }

        if (!this._gotValue) {
            throw new InvalidStateError()
        }

        if (this._request) {
            this._request.readyState = "pending"
        }
        transaction._execRequestAsync({
            operation: async () => {
                let result
                for (let i = 0; i < count; i++) {
                    result = await this._iterate()

                    // Not sure why this is needed
                    if (!result) {
                        break
                    }
                }
                return result
            },
            request: this._request,
            source: this.source,
        })

        this._gotValue = false
    }

    // http://www.w3.org/TR/2015/REC-IndexedDB-20150108/#widl-IDBCursor-continue-void-any-key
    public continue(key?: Key) {
        const effectiveObjectStore = getEffectiveObjectStore(this)
        const transaction = effectiveObjectStore.transaction

        if (transaction._state !== "active") {
            throw new TransactionInactiveError()
        }

        if (effectiveObjectStore._rawObjectStore.deleted) {
            throw new InvalidStateError()
        }
        if (
            !(this.source instanceof FDBObjectStore) &&
            this.source._rawIndex.deleted
        ) {
            throw new InvalidStateError()
        }

        if (!this._gotValue) {
            throw new InvalidStateError()
        }

        if (key !== undefined) {
            key = valueToKey(key)

            const cmpResult = cmp(key, this._position)

            if (
                (cmpResult <= 0 &&
                    (this.direction === "next" ||
                        this.direction === "nextunique")) ||
                (cmpResult >= 0 &&
                    (this.direction === "prev" ||
                        this.direction === "prevunique"))
            ) {
                throw new DataError()
            }
        }

        if (this._request) {
            this._request.readyState = "pending"
        }
        transaction._execRequestAsync({
            operation: this._iterate.bind(this, key),
            request: this._request,
            source: this.source,
        })

        this._gotValue = false
    }

    // hthttps://w3c.github.io/IndexedDB/#dom-idbcursor-continueprimarykey
    public continuePrimaryKey(key: Key, primaryKey: Key) {
        const effectiveObjectStore = getEffectiveObjectStore(this)
        const transaction = effectiveObjectStore.transaction

        if (transaction._state !== "active") {
            throw new TransactionInactiveError()
        }

        if (effectiveObjectStore._rawObjectStore.deleted) {
            throw new InvalidStateError()
        }
        if (
            !(this.source instanceof FDBObjectStore) &&
            this.source._rawIndex.deleted
        ) {
            throw new InvalidStateError()
        }

        if (
            this.source instanceof FDBObjectStore ||
            (this.direction !== "next" && this.direction !== "prev")
        ) {
            throw new InvalidAccessError()
        }

        if (!this._gotValue) {
            throw new InvalidStateError()
        }

        // Not sure about this
        if (key === undefined || primaryKey === undefined) {
            throw new DataError()
        }

        key = valueToKey(key)
        const cmpResult = cmp(key, this._position)
        if (
            (cmpResult === -1 && this.direction === "next") ||
            (cmpResult === 1 && this.direction === "prev")
        ) {
            throw new DataError()
        }
        const cmpResult2 = cmp(primaryKey, this._objectStorePosition)
        if (cmpResult === 0) {
            if (
                (cmpResult2 <= 0 && this.direction === "next") ||
                (cmpResult2 >= 0 && this.direction === "prev")
            ) {
                throw new DataError()
            }
        }

        if (this._request) {
            this._request.readyState = "pending"
        }
        transaction._execRequestAsync({
            operation: this._iterate.bind(this, key, primaryKey),
            request: this._request,
            source: this.source,
        })

        this._gotValue = false
    }

    public delete() {
        const effectiveObjectStore = getEffectiveObjectStore(this)
        const effectiveKey = Object.hasOwn(this.source, "_rawIndex")
            ? this.primaryKey
            : this._position
        const transaction = effectiveObjectStore.transaction

        if (transaction._state !== "active") {
            throw new TransactionInactiveError()
        }

        if (transaction.mode === "readonly") {
            throw new ReadOnlyError()
        }

        if (effectiveObjectStore._rawObjectStore.deleted) {
            throw new InvalidStateError()
        }
        if (
            !(this.source instanceof FDBObjectStore) &&
            this.source._rawIndex.deleted
        ) {
            throw new InvalidStateError()
        }

        if (!this._gotValue || !Object.hasOwn(this, "value")) {
            throw new InvalidStateError()
        }

        return transaction._execRequestAsync({
            operation: effectiveObjectStore._rawObjectStore.deleteRecord.bind(
                effectiveObjectStore._rawObjectStore,
                effectiveKey as Key,
                transaction._rollbackLog,
            ),
            source: this,
        })
    }

    public toString() {
        return "[object IDBCursor]"
    }
}

export default FDBCursor
