import { describe, expect, test } from "vitest"
import { createDatabase, requestToPromise } from "../resources/createDatabase"
import {
    ConstraintError,
    DataError,
    InvalidStateError,
    ReadOnlyError,
} from "../../inMemoryIdb/lib/errors"

// Port of w3c test: idbobjectstore_put.any.js
// Tests IDBObjectStore.put() method functionality

describe("IDBObjectStore.put()", () => {
    test("put() with an inline key", async ({ task }) => {
        const record = { key: 1, property: "data" }

        const db = await createDatabase(task, (db) => {
            const objStore = db.createObjectStore("store", { keyPath: "key" })
            objStore.put(record)
        })

        const tx = db.transaction("store", "readonly")
        const store = tx.objectStore("store")
        const result = await requestToPromise(store.get(record.key))

        expect(result.property).toBe(record.property)
        expect(result.key).toBe(record.key)
    })

    test("put() with an out-of-line key", async ({ task }) => {
        const key = 1
        const record = { property: "data" }

        const db = await createDatabase(task, (db) => {
            const objStore = db.createObjectStore("store")
            objStore.put(record, key)
        })

        const tx = db.transaction("store", "readonly")
        const store = tx.objectStore("store")
        const result = await requestToPromise(store.get(key))

        expect(result.property).toBe(record.property)
    })

    test("put() record with key already exists", async ({ task }) => {
        const record = { key: 1, property: "data" }
        const recordPut = { key: 1, property: "changed", more: ["stuff", 2] }

        const db = await createDatabase(task, (db) => {
            const objStore = db.createObjectStore("store", { keyPath: "key" })
            objStore.put(record)
            const rq = objStore.put(recordPut)
            expect(rq).toBeInstanceOf(Object) // IDBRequest
        })

        const tx = db.transaction("store", "readonly")
        const store = tx.objectStore("store")
        const result = await requestToPromise(store.get(1))

        expect(result.key).toBe(recordPut.key)
        expect(result.property).toBe(recordPut.property)
        expect(result.more).toEqual(recordPut.more)
    })

    test("put() where an index has unique:true specified", async ({ task }) => {
        const record = { key: 1, property: "data" }

        await createDatabase(task, async (db, tx) => {
            const objStore = db.createObjectStore("store", {
                autoIncrement: true,
            })
            tx.onerror = (e) => {
                e.preventDefault()
                expect((e.target as IDBRequest).error).toBeInstanceOf(
                    ConstraintError,
                )
            }
            objStore.createIndex("i1", "property", { unique: true })
            objStore.put(record)

            await expect(
                requestToPromise(objStore.put(record)),
            ).rejects.toThrow(ConstraintError)
        })
    })

    test("Object store's key path is an object attribute", async ({ task }) => {
        const record = { test: { obj: { key: 1 } }, property: "data" }

        const db = await createDatabase(task, (db) => {
            const objStore = db.createObjectStore("store", {
                keyPath: "test.obj.key",
            })
            objStore.put(record)
        })

        const tx = db.transaction("store", "readonly")
        const store = tx.objectStore("store")
        const result = await requestToPromise(store.get(record.test.obj.key))

        expect(result.property).toBe(record.property)
    })

    test("autoIncrement and inline keys", async ({ task }) => {
        const record = { property: "data" }
        const expectedKeys = [1, 2, 3, 4]

        const db = await createDatabase(task, (db) => {
            const objStore = db.createObjectStore("store", {
                keyPath: "key",
                autoIncrement: true,
            })

            objStore.put(record)
            objStore.put(record)
            objStore.put(record)
            objStore.put(record)
        })

        const tx = db.transaction("store", "readonly")
        const store = tx.objectStore("store")
        const cursorRequest = store.openCursor()

        const actualKeys: IDBValidKey[] = []
        let cursor = await requestToPromise(cursorRequest)

        while (cursor) {
            actualKeys.push(cursor.value.key)
            cursor.continue()
            cursor = await requestToPromise(cursorRequest)
        }

        expect(actualKeys).toEqual(expectedKeys)
    })

    test("autoIncrement and out-of-line keys", async ({ task }) => {
        const record = { property: "data" }
        const expectedKeys = [1, 2, 3, 4]

        const db = await createDatabase(task, (db) => {
            const objStore = db.createObjectStore("store", {
                keyPath: "key",
                autoIncrement: true,
            })

            objStore.put(record)
            objStore.put(record)
            objStore.put(record)
            objStore.put(record)
        })

        const tx = db.transaction("store", "readonly")
        const store = tx.objectStore("store")
        const cursorRequest = store.openCursor()

        const actualKeys: IDBValidKey[] = []
        let cursor = await requestToPromise(cursorRequest)

        while (cursor) {
            actualKeys.push(cursor.value.key)
            cursor.continue()
            cursor = await requestToPromise(cursorRequest)
        }

        expect(actualKeys).toEqual(expectedKeys)
    })

    test("Object store has autoIncrement:true and the key path is an object attribute", async ({
        task,
    }) => {
        const record = { property: "data" }
        const expectedKeys = [1, 2, 3, 4]

        const db = await createDatabase(task, (db) => {
            const objStore = db.createObjectStore("store", {
                keyPath: "test.obj.key",
                autoIncrement: true,
            })

            objStore.put(record)
            objStore.put(record)
            objStore.put(record)
            objStore.put(record)
        })

        const tx = db.transaction("store", "readonly")
        const store = tx.objectStore("store")
        const cursorRequest = store.openCursor()

        const actualKeys: IDBValidKey[] = []
        let cursor = await requestToPromise(cursorRequest)

        while (cursor) {
            actualKeys.push(cursor.value.test.obj.key)
            cursor.continue()
            cursor = await requestToPromise(cursorRequest)
        }

        expect(actualKeys).toEqual(expectedKeys)
    })

    test("Attempt to put() a record that does not meet the constraints of an object store's inline key requirements", async ({
        task,
    }) => {
        const record = { key: 1, property: "data" }

        await createDatabase(task, (db) => {
            const objStore = db.createObjectStore("store", { keyPath: "key" })

            expect(() => {
                objStore.put(record, 1)
            }).toThrow(DataError)
        })
    })

    test("Attempt to call put() without an key parameter when the object store uses out-of-line keys", async ({
        task,
    }) => {
        const record = { property: "data" }

        await createDatabase(task, (db) => {
            const objStore = db.createObjectStore("store", { keyPath: "key" })

            expect(() => {
                objStore.put(record)
            }).toThrow(DataError)
        })
    })

    test("Attempt to put() a record where the record's key does not meet the constraints of a valid key", async ({
        task,
    }) => {
        const record = { key: { value: 1 }, property: "data" }

        await createDatabase(task, (db) => {
            const objStore = db.createObjectStore("store", { keyPath: "key" })

            expect(() => {
                objStore.put(record)
            }).toThrow(DataError)
        })
    })

    test("Attempt to put() a record where the record's in-line key is not defined", async ({
        task,
    }) => {
        const record = { property: "data" }

        await createDatabase(task, (db) => {
            const objStore = db.createObjectStore("store", { keyPath: "key" })

            expect(() => {
                objStore.put(record)
            }).toThrow(DataError)
        })
    })

    test("Attempt to put() a record where the out of line key provided does not meet the constraints of a valid key", async ({
        task,
    }) => {
        const record = { property: "data" }

        await createDatabase(task, (db) => {
            const objStore = db.createObjectStore("store")

            expect(() => {
                objStore.put(record, { value: 1 } as unknown as IDBValidKey)
            }).toThrow(DataError)
        })
    })

    test("put() a record where a value being indexed does not meet the constraints of a valid key", async ({
        task,
    }) => {
        const record = { key: 1, indexedProperty: { property: "data" } }

        await createDatabase(task, (db) => {
            const objStore = db.createObjectStore("store", { keyPath: "key" })
            objStore.createIndex("index", "indexedProperty")

            const rq = objStore.put(record)
            expect(rq).toBeInstanceOf(Object) // IDBRequest
        })
    })

    test("If the transaction this IDBObjectStore belongs to has its mode set to readonly, throw ReadOnlyError", async ({
        task,
    }) => {
        const db = await createDatabase(task, (db) => {
            db.createObjectStore("store", { keyPath: "pKey" })
        })

        const txn = db.transaction("store", "readonly")
        const ostore = txn.objectStore("store")

        expect(() => {
            ostore.put({ pKey: "primaryKey_0" })
        }).toThrow(ReadOnlyError)
    })

    test("If the object store has been deleted, the implementation must throw a DOMException of type InvalidStateError", async ({
        task,
    }) => {
        let ostore: IDBObjectStore

        await createDatabase(task, (db) => {
            ostore = db.createObjectStore("store", { keyPath: "pKey" })
            db.deleteObjectStore("store")

            expect(() => {
                ostore.put({ pKey: "primaryKey_0" })
            }).toThrow(InvalidStateError)
        })
    })
})
