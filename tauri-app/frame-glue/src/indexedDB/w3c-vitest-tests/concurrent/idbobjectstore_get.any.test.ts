import { describe, expect, test } from "vitest"
import { createDatabase, requestToPromise } from "../resources/createDatabase"
import { FDBKeyRange as IDBKeyRange } from "../../inMemoryIdb"
import {
    InvalidStateError,
    TransactionInactiveError,
} from "../../inMemoryIdb/lib/errors"

// Port of w3c test: idbobjectstore_get.any.js
// Tests IDBObjectStore.get() method functionality

describe("IDBObjectStore.get()", () => {
    test("Key is a number", async ({ task }) => {
        const record = { key: 3.14159265, property: "data" }

        const db = await createDatabase(task, (db) => {
            const store = db.createObjectStore("store", { keyPath: "key" })
            store.add(record)
        })

        const tx = db.transaction("store", "readonly")
        const store = tx.objectStore("store")
        const result = await requestToPromise(store.get(record.key))

        expect(result.key.valueOf()).toBe(result.key.valueOf())
        expect(result.property).toBe(record.property)
    })

    test("Key is a string", async ({ task }) => {
        const record = {
            key: "this is a key that's a string",
            property: "data",
        }

        const db = await createDatabase(task, (db) => {
            const store = db.createObjectStore("store", { keyPath: "key" })
            store.add(record)
        })

        const tx = db.transaction("store", "readonly")
        const store = tx.objectStore("store")
        const result = await requestToPromise(store.get(record.key))

        expect(result.key.valueOf()).toBe(result.key.valueOf())
        expect(result.property).toBe(record.property)
    })

    test("Key is a date", async ({ task }) => {
        const record = { key: new Date(), property: "data" }

        const db = await createDatabase(task, (db) => {
            const store = db.createObjectStore("store", { keyPath: "key" })
            store.add(record)
        })

        const tx = db.transaction("store", "readonly")
        const store = tx.objectStore("store")
        const result = await requestToPromise(store.get(record.key))

        expect(result.key.valueOf()).toBe(result.key.valueOf())
        expect(result.property).toBe(record.property)
    })

    test("Attempts to retrieve a record that doesn't exist", async ({
        task,
    }) => {
        const db = await createDatabase(task, (db) => {
            db.createObjectStore("store", { keyPath: "key" })
        })

        const tx = db.transaction("store", "readonly")
        const store = tx.objectStore("store")
        const result = await requestToPromise(store.get(1))

        expect(result).toBe(undefined)
    })

    test("Returns the record with the first key in the range", async ({
        task,
    }) => {
        const db = await createDatabase(task, (db) => {
            const os = db.createObjectStore("store")

            for (let i = 0; i < 10; i++) {
                os.add(`data${i}`, i)
            }
        })

        const tx = db.transaction("store", "readonly")
        const store = tx.objectStore("store")
        const result = await requestToPromise(
            store.get(IDBKeyRange.bound(3, 6)),
        )

        expect(result).toBe("data3")
    })

    test("get() with complex object", async ({ task }) => {
        const record = {
            key: "complexKey",
            nested: {
                property: "nested value",
                array: [1, 2, 3],
                object: { deep: "value" },
            },
            simpleArray: ["a", "b", "c"],
        }

        const db = await createDatabase(task, (db) => {
            const store = db.createObjectStore("store", { keyPath: "key" })
            store.add(record)
        })

        const tx = db.transaction("store", "readonly")
        const store = tx.objectStore("store")
        const result = await requestToPromise(store.get(record.key))

        expect(result).toEqual(record)
        expect(result.nested.property).toBe("nested value")
        expect(result.nested.array).toEqual([1, 2, 3])
        expect(result.simpleArray).toEqual(["a", "b", "c"])
    })

    test("If the object store has been deleted, the implementation must throw a DOMException of type InvalidStateError", async ({
        task,
    }) => {
        await createDatabase(task, (db) => {
            const ostore = db.createObjectStore("store", { keyPath: "key" })
            db.deleteObjectStore("store")

            expect(() => {
                ostore.get("key")
            }).toThrow(InvalidStateError)
        })
    })

    test("get() on inactive transaction should throw TransactionInactiveError", async ({
        task,
    }) => {
        const db = await createDatabase(task, (db) => {
            db.createObjectStore("store")
        })

        const tx = db.transaction("store", "readonly")
        const store = tx.objectStore("store")

        // Wait for transaction to finish
        await new Promise<void>((resolve) => {
            tx.oncomplete = () => resolve()
        })

        expect(() => {
            store.get("key")
        }).toThrow(TransactionInactiveError)
    })

    test("get() with array key", async ({ task }) => {
        const record = {
            key: [1, "string", new Date(2000, 1, 1)],
            property: "data",
        }

        const db = await createDatabase(task, (db) => {
            const store = db.createObjectStore("store", { keyPath: "key" })
            store.add(record)
        })

        const tx = db.transaction("store", "readonly")
        const store = tx.objectStore("store")
        const result = await requestToPromise(store.get(record.key))

        expect(result.property).toBe(record.property)
        expect(result.key).toEqual(record.key)
    })
})
