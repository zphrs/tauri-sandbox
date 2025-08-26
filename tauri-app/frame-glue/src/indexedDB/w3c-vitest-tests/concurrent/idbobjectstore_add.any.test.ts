import { describe, expect, test } from "vitest"
import { createDatabase, requestToPromise } from "../resources/createDatabase"
import {
    DataError,
    ReadOnlyError,
    InvalidStateError,
} from "../../inMemoryIdb/lib/errors"

import { FDBRequest as IDBRequest } from "../../inMemoryIdb"

// Port of w3c test: idbobjectstore_add.any.js
// Tests IDBObjectStore.add() method functionality

describe("IDBObjectStore.add()", () => {
    test("add() with an inline key", async ({ task }) => {
        const record = { key: 1, property: "data" }

        const db = await createDatabase(task, (db) => {
            const objStore = db.createObjectStore("store", { keyPath: "key" })
            objStore.add(record)
        })

        const tx = db.transaction("store", "readonly")
        const store = tx.objectStore("store")
        const result = await requestToPromise(store.get(record.key))

        expect(result.property).toBe(record.property)
        expect(result.key).toBe(record.key)
    })

    test("add() with an out-of-line key", async ({ task }) => {
        const key = 1
        const record = { property: "data" }

        const db = await createDatabase(task, (db) => {
            const objStore = db.createObjectStore("store")
            objStore.add(record, key)
        })

        const tx = db.transaction("store", "readonly")
        const store = tx.objectStore("store")
        const result = await requestToPromise(store.get(key))

        expect(result.property).toBe(record.property)
    })

    test("add() record with same key already exists", async ({ task }) => {
        const record = { key: 1, property: "data" }

        await createDatabase(task, (db) => {
            const objStore = db.createObjectStore("store", { keyPath: "key" })
            objStore.add(record)
            console.log("ADDING DUP")
            const rq = objStore.add(record)
            rq.onsuccess = () => {
                throw new Error("success on adding duplicate record")
            }

            rq.onerror = (e) => {
                const target = e.target as unknown as IDBRequest
                expect(target).toBe(rq)
                expect(e.type).toBe("error")
                expect(rq.error?.name).toBe("ConstraintError")
                expect(target?.error?.name).toBe("ConstraintError")
                e.preventDefault()
                e.stopPropagation()
            }
        })

        // Test passes if we reach here without throwing
    })

    test("add() where an index has unique:true specified", async ({ task }) => {
        const record = { key: 1, property: "data" }

        await createDatabase(task, (db) => {
            const objStore = db.createObjectStore("store", {
                autoIncrement: true,
            })
            objStore.createIndex("i1", "property", { unique: true })
            objStore.add(record)

            const rq = objStore.add(record)
            rq.onsuccess = () => {
                throw new Error("success on adding duplicate indexed record")
            }

            rq.onerror = (e) => {
                expect(rq.error?.name).toBe("ConstraintError")
                const target = e.target as unknown as IDBRequest
                expect(target?.error?.name).toBe("ConstraintError")
                expect(e.type).toBe("error")
                e.preventDefault()
                e.stopPropagation()
            }
        })

        // Test passes if we reach here without throwing
    })

    test("add() object store's key path is an object attribute", async ({
        task,
    }) => {
        const record = { test: { obj: { key: 1 } }, property: "data" }

        const db = await createDatabase(task, (db) => {
            const objStore = db.createObjectStore("store", {
                keyPath: "test.obj.key",
            })
            objStore.add(record)
        })

        const tx = db.transaction("store", "readonly")
        const store = tx.objectStore("store")
        const result = await requestToPromise(store.get(record.test.obj.key))

        expect(result.property).toBe(record.property)
    })

    test("add() autoIncrement and inline keys", async ({ task }) => {
        const record = { property: "data" }
        const expectedKeys = [1, 2, 3, 4]

        const db = await createDatabase(task, (db) => {
            const objStore = db.createObjectStore("store", {
                keyPath: "key",
                autoIncrement: true,
            })

            objStore.add(record)
            objStore.add(record)
            objStore.add(record)
            objStore.add(record)
        })

        const tx = db.transaction("store", "readonly")
        const store = tx.objectStore("store")
        const request = store.openCursor()

        const actualKeys: number[] = []
        let cursor = await requestToPromise(request)

        while (cursor) {
            actualKeys.push(cursor.value.key)
            cursor.continue()
            cursor = await requestToPromise(request)
        }

        expect(actualKeys).toEqual(expectedKeys)
    })

    test("add() autoIncrement and out-of-line keys", async ({ task }) => {
        const record = { property: "data" }
        const expectedKeys = [1, 2, 3, 4]

        const db = await createDatabase(task, (db) => {
            const objStore = db.createObjectStore("store", {
                autoIncrement: true,
            })

            objStore.add(record)
            objStore.add(record)
            objStore.add(record)
            objStore.add(record)
        })

        const tx = db.transaction("store", "readonly")
        const store = tx.objectStore("store")
        const request = store.openCursor()

        const actualKeys: number[] = []
        let cursor = await requestToPromise(request)

        while (cursor) {
            actualKeys.push(cursor.key as number)
            cursor.continue()
            cursor = await requestToPromise(request)
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

            objStore.add(record)
            objStore.add(record)
            objStore.add(record)
            objStore.add(record)
        })

        const tx = db.transaction("store", "readonly")
        const store = tx.objectStore("store")
        const request = store.openCursor()

        const actualKeys: number[] = []
        let cursor = await requestToPromise(request)

        while (cursor) {
            actualKeys.push(cursor.value.test.obj.key)
            cursor.continue()
            cursor = await requestToPromise(request)
        }

        expect(actualKeys).toEqual(expectedKeys)
    })

    test("Attempt to 'add()' a record that does not meet the constraints of an object store's inline key requirements", async ({
        task,
    }) => {
        const record = { key: 1, property: "data" }

        await createDatabase(task, (db) => {
            const objStore = db.createObjectStore("store", { keyPath: "key" })

            expect(() => {
                objStore.add(record, 1)
            }).toThrow(DataError)
        })
    })

    test("Attempt to call 'add()' without a key parameter when the object store uses out-of-line keys", async ({
        task,
    }) => {
        const record = { property: "data" }

        await createDatabase(task, (db) => {
            const objStore = db.createObjectStore("store")

            expect(() => {
                objStore.add(record)
            }).toThrow(DataError)
        })
    })

    test("Attempt to 'add()' a record where the record's key does not meet the constraints of a valid key", async ({
        task,
    }) => {
        const record = { key: { value: 1 }, property: "data" }

        await createDatabase(task, (db) => {
            const objStore = db.createObjectStore("store", { keyPath: "key" })

            expect(() => {
                objStore.add(record)
            }).toThrow(DataError)
        })
    })

    test("Attempt to 'add()' a record where the record's in-line key is not defined", async ({
        task,
    }) => {
        const record = { property: "data" }

        await createDatabase(task, (db) => {
            const objStore = db.createObjectStore("store", { keyPath: "key" })

            expect(() => {
                objStore.add(record)
            }).toThrow(DataError)
        })
    })

    test("Attempt to 'add()' a record where the out of line key provided does not meet the constraints of a valid key", async ({
        task,
    }) => {
        const record = { property: "data" }

        await createDatabase(task, (db) => {
            const objStore = db.createObjectStore("store")

            expect(() => {
                objStore.add(record, {} as IDBValidKey) // Invalid object as key
            }).toThrow(DataError)
        })
    })

    test("add() a record where a value being indexed does not meet the constraints of a valid key", async ({
        task,
    }) => {
        const record = { key: 1, indexedProperty: { property: "data" } }

        await createDatabase(task, (db) => {
            const objStore = db.createObjectStore("store", { keyPath: "key" })
            objStore.createIndex("index", "indexedProperty")

            const rq = objStore.add(record)
            expect(rq).toBeInstanceOf(IDBRequest)
        })

        // Test passes if we reach here without throwing
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
            ostore.add({ pKey: "primaryKey_0" })
        }).toThrow(ReadOnlyError)
    })

    test("If the object store has been deleted, the implementation must throw a DOMException of type InvalidStateError", async ({
        task,
    }) => {
        await createDatabase(task, (db) => {
            const ostore = db.createObjectStore("store", { keyPath: "pKey" })
            db.deleteObjectStore("store")

            expect(() => {
                ostore.add({ pKey: "primaryKey_0" })
            }).toThrow(InvalidStateError)
        })
    })
})
