import { FDBKeyRange, FDBTransaction } from "../"

import { ConstraintError } from "./errors"
import extractKey from "./extractKey"
import ObjectStore from "./ObjectStore"
import RecordStore from "./RecordStore"
import type { Key, KeyPath, Record } from "./types"
import valueToKey from "./valueToKey"

// http://www.w3.org/TR/2015/REC-IndexedDB-20150108/#dfn-index
class Index {
    public deleted = false
    // Initialized should be used to decide whether to throw an error or abort the versionchange transaction when there is a
    // constraint
    public initialized = false
    public readonly rawObjectStore: ObjectStore
    public readonly records = new RecordStore()
    public name: string
    public readonly keyPath: KeyPath
    public multiEntry: boolean
    public unique: boolean

    constructor(
        rawObjectStore: ObjectStore,
        name: string,
        keyPath: KeyPath,
        multiEntry: boolean,
        unique: boolean
    ) {
        this.rawObjectStore = rawObjectStore

        this.name = name
        this.keyPath = keyPath
        this.multiEntry = multiEntry
        this.unique = unique
    }

    // http://www.w3.org/TR/2015/REC-IndexedDB-20150108/#dfn-steps-for-retrieving-a-value-from-an-index
    public getKey(key: FDBKeyRange | Key) {
        const record = this.records.get(key)

        return record !== undefined ? record.value : undefined
    }

    // http://w3c.github.io/IndexedDB/#retrieve-multiple-referenced-values-from-an-index
    public getAllKeys(range: FDBKeyRange, count?: number) {
        if (count === undefined || count === 0) {
            count = Infinity
        }

        const records = []
        for (const record of this.records.values(range)) {
            records.push(structuredClone(record.value))
            if (records.length >= count) {
                break
            }
        }

        return records
    }

    // http://www.w3.org/TR/2015/REC-IndexedDB-20150108/#index-referenced-value-retrieval-operation
    public getValue(key: FDBKeyRange | Key) {
        const record = this.records.get(key)

        // can treat it like a key because in index
        return record !== undefined
            ? this.rawObjectStore.getValue(record.value as Key)
            : undefined
    }

    // http://w3c.github.io/IndexedDB/#retrieve-multiple-referenced-values-from-an-index
    public getAllValues(range: FDBKeyRange, count?: number) {
        if (count === undefined || count === 0) {
            count = Infinity
        }

        const records = []
        for (const record of this.records.values(range)) {
            records.push(this.rawObjectStore.getValue(record.value as Key))
            if (records.length >= count) {
                break
            }
        }

        return records
    }

    // http://www.w3.org/TR/2015/REC-IndexedDB-20150108/#dfn-steps-for-storing-a-record-into-an-object-store (step 7)
    public storeRecord(newRecord: Record) {
        let indexKey
        try {
            indexKey = extractKey(this.keyPath, newRecord.value).key
        } catch (err: unknown) {
            const error = err as DOMException
            if (error.name === "DataError") {
                // Invalid key is not an actual error, just means we do not store an entry in this index
                return
            }

            throw err
        }

        if (!this.multiEntry || !Array.isArray(indexKey)) {
            try {
                valueToKey(indexKey)
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
            } catch (e) {
                return
            }
        } else {
            // remove any elements from index key that are not valid keys and remove any duplicate elements from index
            // key such that only one instance of the duplicate value remains.
            const keep = []
            for (const part of indexKey) {
                if (keep.indexOf(part) < 0) {
                    try {
                        keep.push(valueToKey(part))
                        // eslint-disable-next-line @typescript-eslint/no-unused-vars
                    } catch (_err: unknown) {
                        /* Do nothing */
                    }
                }
            }
            indexKey = keep
        }

        if (!this.multiEntry || !Array.isArray(indexKey)) {
            if (this.unique) {
                const existingRecord = this.records.get(indexKey as Key)
                if (existingRecord) {
                    throw new ConstraintError()
                }
            }
        } else {
            if (this.unique) {
                for (const individualIndexKey of indexKey) {
                    const existingRecord = this.records.get(individualIndexKey)
                    if (existingRecord) {
                        throw new ConstraintError()
                    }
                }
            }
        }

        if (!this.multiEntry || !Array.isArray(indexKey)) {
            this.records.add({
                key: indexKey as Key,
                value: newRecord.key,
            })
        } else {
            for (const individualIndexKey of indexKey) {
                this.records.add({
                    key: individualIndexKey,
                    value: newRecord.key,
                })
            }
        }
    }

    public initialize(transaction: FDBTransaction) {
        if (this.initialized) {
            throw new Error("Index already initialized")
        }

        transaction._execRequestAsync({
            operation: () => {
                try {
                    // Create index based on current value of objectstore
                    for (const record of this.rawObjectStore.records.values()) {
                        this.storeRecord(record)
                    }
                    this.initialized = true
                } catch (err: unknown) {
                    // console.error(err);

                    transaction._abort((err as DOMException).name)
                }
            },
            source: null,
        })
    }

    public count(range?: FDBKeyRange) {
        let count = 0

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        for (const _record of this.records.values(range)) {
            count += 1
        }

        return count
    }
}

export default Index
