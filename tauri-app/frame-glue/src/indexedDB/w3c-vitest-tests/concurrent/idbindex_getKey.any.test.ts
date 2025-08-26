import { describe, test, expect } from "vitest"
import {
    createDatabase,
    idb,
    requestToPromise,
    cleanupDbRefAfterTest,
} from "../resources/createDatabase"
import { FDBKeyRange as IDBKeyRange } from "../../inMemoryIdb"
import {
    DataError,
    InvalidStateError,
    TransactionInactiveError,
} from "../../inMemoryIdb/lib/errors"

// Port of w3c test: idbindex_getKey.any.js
// Tests IDBIndex.getKey() method functionality

describe("IDBIndex.getKey()", () => {
    test("getKey() returns the record's primary key", async ({ task }) => {
        const record = { key: 1, indexedProperty: "data" }

        const db = await createDatabase(task, (db) => {
            const objStore = db.createObjectStore("test", { keyPath: "key" })
            objStore.createIndex("index", "indexedProperty")
            objStore.add(record)
        })

        const rq = db
            .transaction("test", "readonly")
            .objectStore("test")
            .index("index")
            .getKey("data")

        const result = await requestToPromise(rq)
        expect(result).toBe(record.key)
    })

    test("getKey() returns the record's primary key where the index contains duplicate values", async ({
        task,
    }) => {
        const records = [
            { key: 1, indexedProperty: "data" },
            { key: 2, indexedProperty: "data" },
            { key: 3, indexedProperty: "data" },
        ]

        const db = await createDatabase(task, (db) => {
            const objStore = db.createObjectStore("test", { keyPath: "key" })
            objStore.createIndex("index", "indexedProperty")

            for (const record of records) {
                objStore.add(record)
            }
        })

        const rq = db
            .transaction("test", "readonly")
            .objectStore("test")
            .index("index")
            .getKey("data")

        const result = await requestToPromise(rq)
        expect(result).toBe(records[0].key)
    })

    test("getKey() attempt to retrieve the primary key of a record that doesn't exist", async ({
        task,
    }) => {
        const req = idb.open(task.id!)
        req.onupgradeneeded = () => {
            const db = req.result
            db.createObjectStore("test", { keyPath: "key" }).createIndex(
                "index",
                "indexedProperty",
            )
        }
        const db = await requestToPromise(
            req as unknown as IDBRequest<IDBDatabase>,
        )
        cleanupDbRefAfterTest(db)

        const rq = db
            .transaction("test", "readonly")
            .objectStore("test")
            .index("index")
            .getKey(1)

        const result = await requestToPromise(rq)
        expect(result).toBeUndefined()
    })

    test("getKey() returns the key of the first record within the range", async ({
        task,
    }) => {
        const db = await createDatabase(task, (db) => {
            const store = db.createObjectStore("store", { keyPath: "key" })
            store.createIndex("index", "indexedProperty")

            for (let i = 0; i < 10; i++) {
                store.add({ key: i, indexedProperty: "data" + i })
            }
        })

        const rq = db
            .transaction("store", "readonly")
            .objectStore("store")
            .index("index")
            .getKey(IDBKeyRange.bound("data4", "data7"))

        const result = await requestToPromise(rq)
        expect(result).toBe(4)
    })

    test("getKey() throws DataError when using invalid key", async ({
        task,
    }) => {
        const db = await createDatabase(task, (db) => {
            const store = db.createObjectStore("test", { keyPath: "key" })
            store.createIndex("index", "indexedProperty")
        })

        const index = db
            .transaction("test", "readonly")
            .objectStore("test")
            .index("index")

        expect(() => {
            index.getKey(NaN)
        }).toThrowError(DataError)
    })

    test("getKey() throws InvalidStateError when the index is deleted", async ({
        task,
    }) => {
        const req = idb.open(task.id!)
        req.onupgradeneeded = () => {
            const db = req.result
            const store = db.createObjectStore("store", { keyPath: "key" })
            const index = store.createIndex("index", "indexedProperty")

            store.add({ key: 1, indexedProperty: "data" })
            store.deleteIndex("index")

            expect(() => {
                index.getKey("data")
            }).toThrowError(InvalidStateError)
        }
        const db = await requestToPromise(
            req as unknown as IDBRequest<IDBDatabase>,
        )
        cleanupDbRefAfterTest(db)
    })

    test("getKey() throws TransactionInactiveError on aborted transaction", async ({
        task,
    }) => {
        const req = idb.open(task.id!)
        req.onupgradeneeded = () => {
            const db = req.result
            const store = db.createObjectStore("store", { keyPath: "key" })
            store.createIndex("index", "indexedProperty")
            store.add({ key: 1, indexedProperty: "data" })
        }
        const db = await requestToPromise(
            req as unknown as IDBRequest<IDBDatabase>,
        )
        cleanupDbRefAfterTest(db)

        const tx = db.transaction("store", "readonly")
        const index = tx.objectStore("store").index("index")
        tx.abort()

        expect(() => {
            index.getKey("data")
        }).toThrowError(TransactionInactiveError)
    })

    test("getKey() throws InvalidStateError on index deleted by aborted upgrade", async ({
        task,
    }) => {
        const req = idb.open(task.id!)
        req.onupgradeneeded = () => {
            const db = req.result
            const store = db.createObjectStore("store", { keyPath: "key" })
            store.createIndex("index", "indexedProperty")
            store.add({ key: 1, indexedProperty: "data" })

            req.transaction!.abort()

            expect(() => {
                store.createIndex("index", "indexedProperty").getKey("data")
            }).toThrowError(InvalidStateError)
        }
        try {
            await requestToPromise(req as unknown as IDBRequest<IDBDatabase>)
            expect.unreachable("open should not succeed")
        } catch {
            // expected error
        }
    })
})
