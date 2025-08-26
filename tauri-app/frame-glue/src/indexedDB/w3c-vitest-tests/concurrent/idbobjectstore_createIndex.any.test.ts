import { describe, expect, test } from "vitest"
import { createDatabase } from "../resources/createDatabase"
import {
    InvalidStateError,
    TransactionInactiveError,
} from "../../inMemoryIdb/lib/errors"

import { FDBIndex as IDBIndex } from "../../inMemoryIdb"

// Port of w3c test: idbobjectstore_createIndex.any.js
// Tests IDBObjectStore.createIndex() method functionality

describe("IDBObjectStore.createIndex()", () => {
    test("Returns an IDBIndex and the properties are set correctly", async ({
        task,
    }) => {
        let objStore: IDBObjectStore | undefined = undefined
        let idx: IDBIndex | undefined = undefined
        await createDatabase(task, (db) => {
            objStore = db.createObjectStore("store")
            idx = objStore.createIndex("index", "indexedProperty", {
                unique: true,
            }) as unknown as IDBIndex
        })
        if (idx === undefined) {
            throw new Error("Expected index to be defined")
        }
        if (objStore === undefined) {
            throw new Error("Expected objStore to be defined")
        }
        const index = idx as IDBIndex
        expect(index).toBeInstanceOf(IDBIndex)
        expect(index.name).toBe("index")
        expect(index.objectStore).toBe(objStore)
        expect(index.keyPath).toBe("indexedProperty")
        expect(index.unique).toBe(true)
        expect(index.multiEntry).toBe(false)
    })

    test("Attempt to create an index that requires unique values on an object store already contains duplicates", async ({
        task,
    }) => {
        const record = { indexedProperty: "bar" }

        // This test should fail during the upgrade transaction
        let aborted = false

        try {
            await createDatabase(task, (db) => {
                const objStore = db.createObjectStore("store")

                objStore.add(record, 1)
                objStore.add(record, 2)
                objStore.createIndex("index", "indexedProperty", {
                    unique: true,
                })
            })
        } catch {
            aborted = true
        }

        expect(aborted).toBe(true)
    })

    test("The index is usable right after being made", async ({ task }) => {
        await createDatabase(task, (db) => {
            const objStore = db.createObjectStore("store", { keyPath: "key" })

            for (let i = 0; i < 100; i++) {
                objStore.add({
                    key: "key_" + i,
                    indexedProperty: "indexed_" + i,
                })
            }

            const idx = objStore.createIndex("index", "indexedProperty")

            idx.get("indexed_99").onsuccess = (e) => {
                const target = e.target as IDBRequest
                expect(target.result.key).toBe("key_99")
            }
            idx.get("indexed_9").onsuccess = (e) => {
                const target = e.target as IDBRequest
                expect(target.result.key).toBe("key_9")
            }
        })

        // Test passes if we reach here without throwing
    })

    test("Empty keyPath", async ({ task }) => {
        await createDatabase(task, (db) => {
            const objStore = db.createObjectStore("store")

            for (let i = 0; i < 5; i++) {
                objStore.add("object_" + i, i)
            }

            const index = objStore.createIndex("index", "")
            expect(index).toBeInstanceOf(IDBIndex)

            const request = objStore.index("index").get("object_4")
            request.onsuccess = (e) => {
                const target = e.target as IDBRequest
                expect(target.result).toBe("object_4")
            }
        })

        // Test passes if we reach here without throwing
    })

    test("If the object store has been deleted, the implementation must throw a DOMException of type InvalidStateError", async ({
        task,
    }) => {
        await createDatabase(task, (db) => {
            const ostore = db.createObjectStore("store", { keyPath: "pKey" })
            db.deleteObjectStore("store")

            expect(() => {
                ostore.createIndex("index", "indexedProperty")
            }).toThrow(InvalidStateError)
        })
    })

    test("If not in an upgrade transaction, throw TransactionInactiveError", async ({
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
            store.createIndex("index", "prop")
        }).toThrow(TransactionInactiveError)
    })

    test("Create index with multiEntry option", async ({ task }) => {
        await createDatabase(task, (db) => {
            const objStore = db.createObjectStore("store")
            const index = objStore.createIndex("index", "tags", {
                multiEntry: true,
            })

            expect(index.multiEntry).toBe(true)
            expect(index.name).toBe("index")
            expect(index.keyPath).toBe("tags")
            expect(index.unique).toBe(false)
        })
    })

    test("Create index with array keyPath", async ({ task }) => {
        await createDatabase(task, (db) => {
            const objStore = db.createObjectStore("store")
            const index = objStore.createIndex("compound", ["first", "second"])

            expect(index.keyPath).toEqual(["first", "second"])
            expect(index.name).toBe("compound")
        })
    })
})
