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

// Port of w3c test: idbindex_get.any.js
// Tests IDBIndex.get() functionality

describe("IDBIndex.get()", () => {
    test("get() returns the record", async ({ task }) => {
        const record = { key: 1, indexedProperty: "data" }
        const db = await createDatabase(task, (db) => {
            const store = db.createObjectStore("store", { keyPath: "key" })
            store.createIndex("index", "indexedProperty")
            store.add(record)
        })

        const index = db
            .transaction("store", "readonly")
            .objectStore("store")
            .index("index")
        const result = await requestToPromise(index.get(record.indexedProperty))
        expect(result.key).toBe(record.key)
    })

    test("get() returns the record where the index contains duplicate values", async ({
        task,
    }) => {
        const db = await createDatabase(task, (db) => {
            const store = db.createObjectStore("test", { keyPath: "key" })
            store.createIndex("index", "indexedProperty")
            for (let i = 0; i < 3; i++)
                store.add({ key: i + 1, indexedProperty: "data" })
        })

        const index = db
            .transaction("test", "readonly")
            .objectStore("test")
            .index("index")
        const result = await requestToPromise(index.get("data"))
        expect(result.key).toBe(1)
    })

    test("get() attempts to retrieve a record that does not exist", async ({
        task,
    }) => {
        const req = idb.open(task.id!)
        req.onupgradeneeded = () => {
            const db = req.result
            const store = db.createObjectStore("test", { keyPath: "key" })
            store.createIndex("index", "indexedProperty")
        }
        const db = await requestToPromise(
            req as unknown as IDBRequest<IDBDatabase>,
        )
        cleanupDbRefAfterTest(db)

        const index = db
            .transaction("test", "readonly")
            .objectStore("test")
            .index("index")
        const result = await requestToPromise(index.get(1))
        expect(result).toBeUndefined()
    })

    test("get() returns the record with the first key in the range", async ({
        task,
    }) => {
        const db = await createDatabase(task, (db) => {
            const store = db.createObjectStore("store", { keyPath: "key" })
            store.createIndex("index", "indexedProperty")
            for (let i = 0; i < 10; i++) {
                store.add({ key: i, indexedProperty: "data" + i })
            }
        })

        const index = db
            .transaction("store", "readonly")
            .objectStore("store")
            .index("index")
        const result = await requestToPromise(
            index.get(IDBKeyRange.bound("data4", "data7")),
        )
        expect(result.key).toBe(4)
        expect(result.indexedProperty).toBe("data4")
    })

    test("get() throws DataError when using invalid key", async ({ task }) => {
        const db = await createDatabase(task, (db) => {
            const store = db.createObjectStore("store", { keyPath: "key" })
            store.createIndex("index", "indexedProperty")
        })
        const index = db
            .transaction("store", "readonly")
            .objectStore("store")
            .index("index")
        expect(() => {
            index.get(NaN)
        }).toThrowError(DataError)
    })

    test("get() throws InvalidStateError when the index is deleted", async ({
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
                index.get("data")
            }).toThrowError(InvalidStateError)
        }
        const db = await requestToPromise(
            req as unknown as IDBRequest<IDBDatabase>,
        )
        cleanupDbRefAfterTest(db)
    })

    test("get() throws TransactionInactiveError on aborted transaction", async ({
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
            index.get("data")
        }).toThrowError(TransactionInactiveError)
    })

    test("get() throws InvalidStateError on index deleted by aborted upgrade", async ({
        task,
    }) => {
        const req = idb.open(task.id!)
        req.onupgradeneeded = () => {
            const db = req.result
            const store = db.createObjectStore("store", { keyPath: "key" })
            const index = store.createIndex("index", "indexedProperty")
            store.add({ key: 1, indexedProperty: "data" })
            req.transaction!.abort()
            expect(() => {
                index.get("data")
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
