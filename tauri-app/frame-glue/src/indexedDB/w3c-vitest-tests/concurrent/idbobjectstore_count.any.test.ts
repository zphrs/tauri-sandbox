import { describe, expect, test } from "vitest"
import { createDatabase, requestToPromise } from "../resources/createDatabase"
import { FDBKeyRange as IDBKeyRange } from "../../inMemoryIdb"
import { InvalidStateError } from "../../inMemoryIdb/lib/errors"

// Port of w3c test: idbobjectstore_count.any.js
// Tests IDBObjectStore.count() method functionality

describe("IDBObjectStore.count()", () => {
    test("Returns the number of records in the object store", async ({
        task,
    }) => {
        const db = await createDatabase(task, (db) => {
            const store = db.createObjectStore("store")

            for (let i = 0; i < 10; i++) {
                store.add({ data: "data" + i }, i)
            }
        })

        const tx = db.transaction("store", "readonly")
        const store = tx.objectStore("store")
        const result = await requestToPromise(store.count())

        expect(result).toBe(10)
    })

    test("Returns the number of records that have keys within the range", async ({
        task,
    }) => {
        const db = await createDatabase(task, (db) => {
            const store = db.createObjectStore("store")

            for (let i = 0; i < 10; i++) {
                store.add({ data: "data" + i }, i)
            }
        })

        const tx = db.transaction("store", "readonly")
        const store = tx.objectStore("store")
        const result = await requestToPromise(
            store.count(IDBKeyRange.bound(5, 20)),
        )

        expect(result).toBe(5)
    })

    test("Returns the number of records that have keys with the key", async ({
        task,
    }) => {
        const db = await createDatabase(task, (db) => {
            const store = db.createObjectStore("store", { keyPath: "k" })

            for (let i = 0; i < 5; i++) {
                store.add({ k: "key_" + i })
            }
        })

        const tx = db.transaction("store", "readonly")
        const store = tx.objectStore("store")

        const result1 = await requestToPromise(store.count("key_2"))
        expect(result1).toBe(1)

        const result2 = await requestToPromise(store.count("key_"))
        expect(result2).toBe(0)
    })

    test("If the object store has been deleted, the implementation must throw a DOMException of type InvalidStateError", async ({
        task,
    }) => {
        await createDatabase(task, (db) => {
            const ostore = db.createObjectStore("store", { keyPath: "pKey" })
            db.deleteObjectStore("store")

            expect(() => {
                ostore.count()
            }).toThrow(InvalidStateError)
        })
    })
})
