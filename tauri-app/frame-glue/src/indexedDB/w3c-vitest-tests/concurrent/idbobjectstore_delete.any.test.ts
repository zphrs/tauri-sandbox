import { describe, expect, test } from "vitest"
import { createDatabase, requestToPromise } from "../resources/createDatabase"
import { FDBKeyRange as IDBKeyRange } from "../../inMemoryIdb"
import {
    ReadOnlyError,
    InvalidStateError,
    TransactionInactiveError,
} from "../../inMemoryIdb/lib/errors"

// Port of w3c test: idbobjectstore_delete.any.js
// Tests IDBObjectStore.delete() method functionality

describe("IDBObjectStore.delete()", () => {
    test("delete() removes record (inline keys)", async ({ task }) => {
        const record = { key: 1, property: "data" }

        const db = await createDatabase(task, (db) => {
            const objStore = db.createObjectStore("test", { keyPath: "key" })
            objStore.add(record)
        })

        const tx = db.transaction("test", "readwrite")
        const store = tx.objectStore("test")
        const deleteResult = await requestToPromise(store.delete(record.key))

        expect(deleteResult).toBe(undefined)

        // Verify record was removed
        const tx2 = db.transaction("test", "readonly")
        const store2 = tx2.objectStore("test")
        const getResult = await requestToPromise(store2.get(record.key))

        expect(getResult).toBe(undefined)
    })

    test("delete() key doesn't match any records", async ({ task }) => {
        const db = await createDatabase(task, (db) => {
            db.createObjectStore("test")
        })

        const tx = db.transaction("test", "readwrite")
        const store = tx.objectStore("test")
        const result = await requestToPromise(store.delete(1))

        expect(result).toBe(undefined)
    })

    test("Object store's key path is an object attribute", async ({ task }) => {
        const record = { test: { obj: { key: 1 } }, property: "data" }

        const db = await createDatabase(task, (db) => {
            const objStore = db.createObjectStore("test", {
                keyPath: "test.obj.key",
            })
            objStore.add(record)
        })

        const tx = db.transaction("test", "readwrite")
        const store = tx.objectStore("test")
        const deleteResult = await requestToPromise(
            store.delete(record.test.obj.key),
        )

        expect(deleteResult).toBe(undefined)

        // Verify record was removed
        const tx2 = db.transaction("test", "readonly")
        const store2 = tx2.objectStore("test")
        const getResult = await requestToPromise(
            store2.get(record.test.obj.key),
        )

        expect(getResult).toBe(undefined)
    })

    test("delete() with a key range", async ({ task }) => {
        const db = await createDatabase(task, (db) => {
            const objStore = db.createObjectStore("test")

            for (let i = 0; i < 10; i++) {
                objStore.add({ data: "data" + i }, i)
            }
        })

        const tx = db.transaction("test", "readwrite")
        const store = tx.objectStore("test")
        const result = await requestToPromise(
            store.delete(IDBKeyRange.bound(3, 6)),
        )

        expect(result).toBe(undefined)

        // Verify records were removed
        const tx2 = db.transaction("test", "readonly")
        const store2 = tx2.objectStore("test")
        const count = await requestToPromise(store2.count())

        expect(count).toBe(6) // 0,1,2,7,8,9 remain
    })

    test("If the transaction this IDBObjectStore belongs to has its mode set to readonly, throw ReadOnlyError", async ({
        task,
    }) => {
        const record = { pKey: "primaryKey_0" }

        const db = await createDatabase(task, (db) => {
            const objStore = db.createObjectStore("store", { keyPath: "pKey" })
            objStore.add(record)
        })

        const txn = db.transaction("store", "readonly")
        const ostore = txn.objectStore("store")

        expect(() => {
            ostore.delete(record.pKey)
        }).toThrow(ReadOnlyError)
    })

    test("If the object store has been deleted, the implementation must throw a DOMException of type InvalidStateError", async ({
        task,
    }) => {
        await createDatabase(task, (db) => {
            const ostore = db.createObjectStore("store", { keyPath: "pKey" })
            db.deleteObjectStore("store")

            expect(() => {
                ostore.delete("key")
            }).toThrow(InvalidStateError)
        })
    })

    test("delete() with an invalid key should throw DataError", async ({
        task,
    }) => {
        const db = await createDatabase(task, (db) => {
            db.createObjectStore("store")
        })

        const tx = db.transaction("store", "readwrite")
        const store = tx.objectStore("store")

        expect(() => {
            store.delete({} as IDBValidKey) // Invalid key
        }).toThrow()
    })

    test("delete() on inactive transaction should throw TransactionInactiveError", async ({
        task,
    }) => {
        const db = await createDatabase(task, (db) => {
            db.createObjectStore("store")
        })

        const tx = db.transaction("store", "readwrite")
        const store = tx.objectStore("store")

        // Wait for transaction to finish
        await new Promise<void>((resolve) => {
            tx.oncomplete = () => resolve()
        })

        expect(() => {
            store.delete("key")
        }).toThrow(TransactionInactiveError)
    })
})
