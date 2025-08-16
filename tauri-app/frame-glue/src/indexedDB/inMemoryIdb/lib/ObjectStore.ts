import { call } from "../../../rpcOverPorts"
import type {
    CountMethod,
    ExecuteReadMethod,
    GetAllKeysMethod,
    GetAllRecordsMethod,
    Read,
} from "../../methods/readFromStore"
import FDBKeyRange from "../FDBKeyRange"
import cmp from "./cmp"
import Database from "./Database"
import { ConstraintError, DataError } from "./errors"
import extractKey from "./extractKey"
import Index from "./Index"
import KeyGenerator from "./KeyGenerator"
import RecordStore from "./RecordStore"
import type { Key, KeyPath, Record, RollbackLog } from "./types"

// http://www.w3.org/TR/2015/REC-IndexedDB-20150108/#dfn-object-store
class ObjectStore {
    public deleted = false
    public readonly rawDatabase: Database
    public readonly records = new RecordStore()
    public readonly rawIndexes: Map<string, Index> = new Map()
    public name: string
    public readonly keyPath: KeyPath | null
    public readonly autoIncrement: boolean
    public readonly keyGenerator: KeyGenerator | null

    constructor(
        rawDatabase: Database,
        name: string,
        keyPath: KeyPath | null,
        autoIncrement: boolean
    ) {
        this.rawDatabase = rawDatabase
        this.keyGenerator = autoIncrement === true ? new KeyGenerator() : null
        this.deleted = false

        this.name = name
        this.keyPath = keyPath
        this.autoIncrement = autoIncrement
    }

    // http://www.w3.org/TR/2015/REC-IndexedDB-20150108/#dfn-steps-for-retrieving-a-value-from-an-object-store
    public async getKey(key: FDBKeyRange | Key) {
        let k: FDBKeyRange
        if (!(key instanceof FDBKeyRange)) {
            k = FDBKeyRange.only(key)
        } else {
            k = key
        }

        return (await this.getAllRecords(k, 1, true)).map((r) => r.key)
    }

    // http://w3c.github.io/IndexedDB/#retrieve-multiple-keys-from-an-object-store
    public async getAllKeys(range: FDBKeyRange | undefined, count?: number) {
        return (await this.getAllRecords(range, count, true)).map((r) => r.key)
    }

    private async executeReadMethod<
        Method extends ExecuteReadMethod<Read, unknown>
    >(
        method: Method["req"]["params"]["call"]["method"],
        params: Method["req"]["params"]["call"]["params"]
    ) {
        const readCall = { method, params } as Method["req"]["params"]["call"]
        return await call<Method>(this.rawDatabase._port, "executeReadMethod", {
            params: {
                dbName: this.rawDatabase.name,
                store: this.name,
                call: readCall,
            },
            transferableObjects: [],
        })
    }

    // http://www.w3.org/TR/2015/REC-IndexedDB-20150108/#dfn-steps-for-retrieving-a-value-from-an-object-store
    public async getValue(key: FDBKeyRange | Key) {
        console.log("GETTING VALUE FROM STORE", this.name, key)
        let k: FDBKeyRange
        if (!(key instanceof FDBKeyRange)) {
            k = FDBKeyRange.only(key)
        } else {
            k = key
        }
        const val = (await this.getAllRecords(k, 1)).map((r) => r.value)
        return val[0]
    }

    private async getAllRecords(
        range: FDBKeyRange | undefined,
        count: number | undefined,
        ignoreValues: boolean = false
    ): Promise<Record[]> {
        if (count === undefined || count === 0) {
            count = Infinity
        }
        const kvPromise = this.executeReadMethod<
            GetAllRecordsMethod | GetAllKeysMethod
        >(ignoreValues ? "getAllKeys" : "getAllRecords", {
            query: range,
            // need to get `count` values for the case that all the cached
            // keys in the range are greater than all fetched keys
            // in the range
            count: Number.isFinite(count) ? count : undefined,
        })
        const cachedRecords: Record[] = []
        for (const record of this.records.values(range)) {
            cachedRecords.push(structuredClone(record))
            if (cachedRecords.length >= count) {
                break
            }
        }
        // starts above and awaits here because the RPC
        // executes on its own, so we can parallelize the fetches
        const [values, keys] = (
            ignoreValues
                ? [await kvPromise, await kvPromise] // if just getting keys, replace values with keys
                : await kvPromise
        ) as [unknown[], IDBValidKey[]]
        const fetchedRecords = keys.map((k, i) => {
            return {
                key: k,
                value: values[i],
            }
        })

        // in case a key in the range is updated via a transaction
        // for (const record of fetchedRecords) {
        //     const cachedValue = this.records.get(record.key)
        //     if (cachedValue) {
        //         record.value = cachedValue.value
        //     }
        // }

        console.log({ fetchedRecords, cachedRecords })

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
                    // with records from the fetch
                    out.push(fetchedRecords[i++])
                    break
                }
                case 1: {
                    out.push(cachedRecords[j++])
                    break
                }
                case 0: {
                    // if two keys are identical, keep the cached, throw away
                    // fetched.
                    // This is because cached can contain writes done in the current
                    // transaction.
                    out.push(cachedRecords[j++])
                    // skip the identical key from fetched
                    i++
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

    // http://w3c.github.io/IndexedDB/#retrieve-multiple-values-from-an-object-store
    // cannot serve from cache because there can always be a value which is
    // somewhere along the range that isn't in the cache
    public async getAllValues(range: FDBKeyRange, count?: number) {
        return (await this.getAllRecords(range, count)).map((r) => r.value)
    }

    // http://www.w3.org/TR/2015/REC-IndexedDB-20150108/#dfn-steps-for-storing-a-record-into-an-object-store
    public async storeRecord(
        newRecord: Record,
        noOverwrite: boolean,
        rollbackLog?: RollbackLog
    ) {
        if (this.keyPath !== null) {
            const key = extractKey(this.keyPath, newRecord.value).key
            if (key !== undefined) {
                newRecord.key = key as Key
            }
        }

        if (this.keyGenerator !== null && newRecord.key === undefined) {
            if (rollbackLog) {
                const keyGeneratorBefore = this.keyGenerator.num
                rollbackLog.push(() => {
                    if (this.keyGenerator) {
                        this.keyGenerator.num = keyGeneratorBefore
                    }
                })
            }

            newRecord.key = this.keyGenerator.next()

            // Set in value if keyPath defiend but led to no key
            // http://www.w3.org/TR/2015/REC-IndexedDB-20150108/#dfn-steps-to-assign-a-key-to-a-value-using-a-key-path
            if (this.keyPath !== null) {
                if (Array.isArray(this.keyPath)) {
                    throw new Error(
                        "Cannot have an array key path in an object store with a key generator"
                    )
                }
                let remainingKeyPath = this.keyPath
                let object = newRecord.value
                let identifier

                let i = 0 // Just to run the loop at least once
                while (i >= 0) {
                    if (typeof object !== "object") {
                        throw new DataError()
                    }

                    i = remainingKeyPath.indexOf(".")
                    if (i >= 0) {
                        identifier = remainingKeyPath.slice(0, i)
                        remainingKeyPath = remainingKeyPath.slice(i + 1)

                        if (
                            object !== null &&
                            !Object.hasOwn(object, identifier)
                        ) {
                            ;(object as { [key: string]: unknown })[
                                identifier
                            ] = {}
                        }

                        object = (object as { [key: string]: unknown })[
                            identifier
                        ]
                    }
                }

                identifier = remainingKeyPath
                ;(object as { [key: string]: unknown })[identifier] =
                    newRecord.key
            }
        } else if (
            this.keyGenerator !== null &&
            typeof newRecord.key === "number"
        ) {
            this.keyGenerator.setIfLarger(newRecord.key)
        }

        let recordExists: boolean =
            this.records.get(newRecord.key) !== undefined
        if (!recordExists) {
            const ct = await call<CountMethod>(
                this.rawDatabase._port,
                "executeReadMethod",
                {
                    dbName: this.rawDatabase.name,
                    store: this.name,
                    call: {
                        method: "count",
                        params: { query: newRecord.key as IDBValidKey },
                    },
                }
            )
            recordExists = ct !== 0
        }
        if (recordExists) {
            if (noOverwrite) {
                console.log("\nWOW SCARYYYY", recordExists, "\n")
                throw new ConstraintError()
            }
            this.deleteRecord(newRecord.key, rollbackLog)
        }

        console.log("Adding record:", newRecord)

        this.records.add(newRecord)

        if (rollbackLog) {
            rollbackLog.push(() => {
                this.deleteRecord(newRecord.key)
            })
        }

        // Update indexes
        for (const rawIndex of this.rawIndexes.values()) {
            if (rawIndex.initialized) {
                rawIndex.storeRecord(newRecord)
            }
        }

        return newRecord.key
    }

    // http://www.w3.org/TR/2015/REC-IndexedDB-20150108/#dfn-steps-for-deleting-records-from-an-object-store
    public deleteRecord(key: Key, rollbackLog?: RollbackLog) {
        const deletedRecords = this.records.delete(key)

        if (rollbackLog) {
            for (const record of deletedRecords) {
                rollbackLog.push(() => {
                    this.storeRecord(record, true)
                })
            }
        }

        for (const rawIndex of this.rawIndexes.values()) {
            rawIndex.records.deleteByValue(key)
        }
    }

    // http://www.w3.org/TR/2015/REC-IndexedDB-20150108/#dfn-steps-for-clearing-an-object-store
    public clear(rollbackLog: RollbackLog) {
        const deletedRecords = this.records.clear()

        if (rollbackLog) {
            for (const record of deletedRecords) {
                rollbackLog.push(() => {
                    this.storeRecord(record, true)
                })
            }
        }

        for (const rawIndex of this.rawIndexes.values()) {
            rawIndex.records.clear()
        }
    }

    public async count(range?: FDBKeyRange) {
        // getAllKeys

        return (await this.getAllKeys(range)).length
    }
}

export default ObjectStore
