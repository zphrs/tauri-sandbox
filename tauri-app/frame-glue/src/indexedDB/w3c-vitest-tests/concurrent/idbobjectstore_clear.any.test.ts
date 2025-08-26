import { describe, expect, test } from "vitest"
import { createDatabase, requestToPromise } from "../resources/createDatabase"
import { ReadOnlyError, InvalidStateError } from "../../inMemoryIdb/lib/errors"

// Port of w3c test: idbobjectstore_clear.any.js
// Tests IDBObjectStore.clear() method functionality

describe("IDBObjectStore.clear()", () => {
    test("Verify clear removes all records", async ({ task }) => {
        const db = await createDatabase(task, (db) => {
            const objStore = db.createObjectStore("store", {
                autoIncrement: true,
            })

            objStore.add({ property: "data" })
            objStore.add({ something_different: "Yup, totally different" })
            objStore.add(1234)
            objStore.add([1, 2, 1234])

            objStore.clear().onsuccess = (e) => {
                const target = e.target as IDBRequest
                expect(target?.result).toBe(undefined)
            }
        })

        const tx = db.transaction("store", "readonly")
        const store = tx.objectStore("store")
        const result = await requestToPromise(store.openCursor())

        expect(result).toBe(null)
    })

    test("Clear removes all records from an index", async ({ task }) => {
        const db = await createDatabase(task, (db) => {
            const objStore = db.createObjectStore("store", {
                autoIncrement: true,
            })
            objStore.createIndex("index", "indexedProperty")

            objStore.add({ indexedProperty: "data" })
            objStore.add({
                indexedProperty: "yo, man",
                something_different: "Yup, totally different",
            })
            objStore.add({ indexedProperty: 1234 })
            objStore.add({ indexedProperty: [1, 2, 1234] })
            objStore.add(1234)

            objStore.clear().onsuccess = (e) => {
                const target = e.target as IDBRequest
                expect(target?.result).toBe(undefined)
            }
        })

        const tx = db.transaction("store", "readonly")
        const store = tx.objectStore("store")
        const index = store.index("index")
        const result = await requestToPromise(index.openCursor())

        expect(result).toBe(null)
    })

    test("If the transaction this IDBObjectStore belongs to has its mode set to readonly, throw ReadOnlyError", async ({
        task,
    }) => {
        const records = [{ pKey: "primaryKey_0" }, { pKey: "primaryKey_1" }]

        const db = await createDatabase(task, (db) => {
            const objStore = db.createObjectStore("store", { keyPath: "pKey" })
            for (const record of records) {
                objStore.add(record)
            }
        })

        const txn = db.transaction("store", "readonly")
        const ostore = txn.objectStore("store")

        expect(() => {
            ostore.clear()
        }).toThrow(ReadOnlyError)
    })

    test("If the object store has been deleted, the implementation must throw a DOMException of type InvalidStateError", async ({
        task,
    }) => {
        await createDatabase(task, (db) => {
            const ostore = db.createObjectStore("store", { keyPath: "pKey" })
            db.deleteObjectStore("store")

            expect(() => {
                ostore.clear()
            }).toThrow(InvalidStateError)
        })
    })
})
