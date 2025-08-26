import { describe, test, expect } from "vitest"
import { createDatabase, requestToPromise } from "../resources/createDatabase"
import { FDBKeyRange as IDBKeyRange } from "../../inMemoryIdb"
import { DataError } from "../../inMemoryIdb/lib/errors"

// Port of w3c test: idbindex_count.any.js
// Tests IDBIndex.count() functionality

describe("IDBIndex.count()", () => {
    test("count() returns the number of records in the index", async ({
        task,
    }) => {
        const db = await createDatabase(task, (db) => {
            const store = db.createObjectStore("store", { autoIncrement: true })
            store.createIndex("index", "indexedProperty")
            for (let i = 0; i < 10; i++) {
                store.add({ indexedProperty: "data" + i })
            }
        })

        const tx = db.transaction("store", "readonly")
        const index = tx.objectStore("store").index("index")
        const count = await requestToPromise(index.count())
        expect(count).toBe(10)
    })

    test("count() returns the number of records that have keys within the range", async ({
        task,
    }) => {
        const db = await createDatabase(task, (db) => {
            const store = db.createObjectStore("store", { autoIncrement: true })
            store.createIndex("index", "indexedProperty")
            for (let i = 0; i < 10; i++) {
                store.add({ indexedProperty: "data" + i })
            }
        })

        const tx = db.transaction("store", "readonly")
        const index = tx.objectStore("store").index("index")
        const count = await requestToPromise(
            index.count(IDBKeyRange.bound("data0", "data4")),
        )
        expect(count).toBe(5)
    })

    test("count() returns the number of records that have keys with the key", async ({
        task,
    }) => {
        const db = await createDatabase(task, (db) => {
            const store = db.createObjectStore("store", { autoIncrement: true })
            store.createIndex("myindex", "idx")
            for (let i = 0; i < 10; i++) {
                store.add({ idx: "data_" + (i % 2) })
            }
        })

        const tx = db.transaction("store", "readonly")
        const index = tx.objectStore("store").index("myindex")
        const count = await requestToPromise(index.count("data_0"))
        expect(count).toBe(5)
    })

    test("count() throws DataError when using invalid key", async ({
        task,
    }) => {
        const db = await createDatabase(task, (db) => {
            const store = db.createObjectStore("store", { autoIncrement: true })
            store.createIndex("index", "indexedProperty")
        })
        const tx = db.transaction("store", "readonly")
        const index = tx.objectStore("store").index("index")
        expect(() => {
            index.count(NaN)
        }).toThrowError(DataError)
    })
})
