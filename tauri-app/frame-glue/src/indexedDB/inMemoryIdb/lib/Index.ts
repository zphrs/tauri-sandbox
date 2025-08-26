import { FDBKeyRange, FDBTransaction } from "../"
import { call } from "../../../rpcOverPorts"
import type {
    ExecuteReadMethod,
    GetAllRecordsFromIndexMethod,
    Read,
} from "../../methods/readFromStore"
import { cmp } from "./cmp"

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
        unique: boolean,
    ) {
        this.rawObjectStore = rawObjectStore

        this.name = name
        this.keyPath = keyPath
        this.multiEntry = multiEntry
        this.unique = unique
    }

    // http://www.w3.org/TR/2015/REC-IndexedDB-20150108/#dfn-steps-for-retrieving-a-value-from-an-index
    public async getKey(key: FDBKeyRange | Key) {
        const out = await this._getAllRecords(
            key instanceof FDBKeyRange ? key : FDBKeyRange.only(key),
            1,
        )
        if (out.length === 0) {
            return undefined
        }
        return out[0].value
    }

    // http://w3c.github.io/IndexedDB/#retrieve-multiple-referenced-values-from-an-index
    public async getAllKeys(range: FDBKeyRange, count?: number) {
        if (count === undefined || count === 0) {
            count = Infinity
        }

        const records: Record[] = await this._getAllRecords(
            range instanceof FDBKeyRange ? range : FDBKeyRange.only(range),
            count,
        )

        const out = []
        for (const record of records) {
            out.push(structuredClone(record.value as Key))
            if (out.length >= count) {
                break
            }
        }

        return records
    }

    // http://www.w3.org/TR/2015/REC-IndexedDB-20150108/#index-referenced-value-retrieval-operation
    public async getValue(key: FDBKeyRange | Key) {
        const record: Record | undefined = (
            await this._getAllRecords(
                key instanceof FDBKeyRange ? key : FDBKeyRange.only(key),
                1,
            )
        )[0]

        const foundValue =
            record !== undefined
                ? await this.rawObjectStore.getValue(record.value as Key)
                : undefined

        return foundValue
    }

    public async _executeReadMethod<
        Method extends ExecuteReadMethod<Read, unknown>,
    >(
        method: Method["req"]["params"]["call"]["method"],
        params: Method["req"]["params"]["call"]["params"],
    ) {
        const readCall = { method, params } as Method["req"]["params"]["call"]
        return await call<Method>(
            this.rawObjectStore.rawDatabase._port,
            "executeReadMethod",
            {
                params: {
                    dbName: this.rawObjectStore.rawDatabase.name,
                    store: this.rawObjectStore.name,
                    call: readCall,
                },
                transferableObjects: [],
            },
        )
    }

    public async _getAllRecords(
        range: FDBKeyRange | undefined,
        count: number | undefined,
    ) {
        if (count === undefined || count === 0) {
            count = Infinity
        }

        const kvPromise = this._executeReadMethod<GetAllRecordsFromIndexMethod>(
            "getAllRecordsFromIndex",
            {
                indexName: this.name,
                query: range,
                count: Number.isFinite(count) ? count : undefined,
            },
        )

        const cachedRecords: Record[] = []

        for (const record of this.records.values(range)) {
            cachedRecords.push(structuredClone(record))
            if (cachedRecords.length >= count) {
                break
            }
        }

        // starts above and awaits here because the RPC
        // executes on its own, so we can parallelize the fetches
        const [values, keys] = await kvPromise
        // above are objectStore records; need to get converted into index records
        const fetchedRecords = keys
            .flatMap((k, i) => {
                const inlineRecord = { key: k, value: values[i] }
                return this.convertRecordToIndexRecord(inlineRecord, true)
            })
            .filter((v) => !this.rawObjectStore.records.modified(v.value))

        // mergesort
        const out: Record[] = []
        let i = 0,
            j = 0
        while (
            fetchedRecords.length > i &&
            cachedRecords.length > j &&
            out.length < count
        ) {
            switch (cmp(fetchedRecords[i].key, cachedRecords[j].key)) {
                case -1: {
                    // To avoid bloating cache, we do not update the cache
                    // with records from the fetched records
                    out.push(fetchedRecords[i++])
                    break
                }
                case 1: {
                    out.push(cachedRecords[j++])
                    break
                }
                case 0: {
                    out.push(fetchedRecords[i++])
                    out.push(cachedRecords[j++])
                }
            }
        }
        if (out.length === count) {
            return out
        }
        if (fetchedRecords.length > i) {
            out.push(...fetchedRecords.slice(i, i + (count - out.length)))
        }
        if (cachedRecords.length > j) {
            out.push(...cachedRecords.slice(j, j + (count - out.length)))
        }

        return out
    }

    // http://w3c.github.io/IndexedDB/#retrieve-multiple-referenced-values-from-an-index
    public async getAllValues(range: FDBKeyRange, count?: number) {
        if (count === undefined || count === 0) {
            count = Infinity
        }

        const records: Record[] = await this._getAllRecords(
            range instanceof FDBKeyRange ? range : FDBKeyRange.only(range),
            count,
        )

        const outPromises = [] as Promise<unknown>[]
        for (const record of records) {
            outPromises.push(this.rawObjectStore.getValue(record.value as Key))
            if (outPromises.length >= count) {
                break
            }
        }

        return await Promise.all(outPromises)
    }

    private convertRecordToIndexRecord(
        record: Record,
        skipUniquenessVerification: boolean = false,
    ) {
        let indexKey
        try {
            indexKey = extractKey(this.keyPath, record.value).key
        } catch (err: unknown) {
            const error = err as DOMException
            if (error.name === "DataError") {
                // Invalid key is not an actual error, just means we do not store an entry in this index
                return []
            }

            throw err
        }

        if (!this.multiEntry || !Array.isArray(indexKey)) {
            try {
                valueToKey(indexKey)
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
            } catch (e) {
                return []
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

        if (!skipUniquenessVerification) {
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
                        const existingRecord =
                            this.records.get(individualIndexKey)
                        if (existingRecord) {
                            throw new ConstraintError()
                        }
                    }
                }
            }
        }

        if (!this.multiEntry || !Array.isArray(indexKey)) {
            return {
                key: indexKey as Key,
                value: record.key,
            }
        } else {
            return indexKey.map((v) => {
                return {
                    key: v as Key,
                    value: record.key,
                }
            })
        }
    }

    // http://www.w3.org/TR/2015/REC-IndexedDB-20150108/#dfn-steps-for-storing-a-record-into-an-object-store (step 7)
    public storeRecord(newRecord: Record) {
        const idxRecord = this.convertRecordToIndexRecord(newRecord)
        if (Array.isArray(idxRecord)) {
            for (const record of idxRecord) {
                this.records.add(record)
            }
        } else {
            this.records.add(idxRecord)
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
