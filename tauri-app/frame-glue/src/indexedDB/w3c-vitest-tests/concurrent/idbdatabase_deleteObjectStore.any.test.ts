import { describe, expect, test } from "vitest"
import { createDatabase } from "../resources/createDatabase"
import { InvalidStateError, NotFoundError } from "../../inMemoryIdb/lib/errors"

// Port of w3c test: idbdatabase_deleteObjectStore.any.js
// Tests IDBDatabase.deleteObjectStore() method functionality

describe("IDBDatabase.deleteObjectStore()", () => {
    test("Deleted object store's name should be removed from database's list. Attempting to use a deleted IDBObjectStore should throw an InvalidStateError", async ({
        task,
    }) => {
        let db: IDBDatabase
        let addSuccess = false

        await new Promise<IDBDatabase>((resolve, reject) => {
            createDatabase(task, (database) => {
                db = database

                const objStore = db.createObjectStore("store", {
                    autoIncrement: true,
                })
                expect(db.objectStoreNames[0]).toBe("store")

                const rqAdd = objStore.add(1)
                rqAdd.onsuccess = function () {
                    addSuccess = true
                }
                rqAdd.onerror = () => reject(new Error("rq_add.error"))

                objStore.createIndex("idx", "a")
                db.deleteObjectStore("store")
                expect(db.objectStoreNames.length).toBe(0)
                expect(db.objectStoreNames.contains("store")).toBe(false)

                // Test that the deleted object store throws InvalidStateError for all operations
                expect(() => objStore.add(2)).toThrow(InvalidStateError)
                expect(() => objStore.put(3)).toThrow(InvalidStateError)
                expect(() => objStore.get(1)).toThrow(InvalidStateError)
                expect(() => objStore.clear()).toThrow(InvalidStateError)
                expect(() => objStore.count()).toThrow(InvalidStateError)
                expect(() => objStore.delete(1)).toThrow(InvalidStateError)
                expect(() => objStore.openCursor()).toThrow(InvalidStateError)
                expect(() => objStore.index("idx")).toThrow(InvalidStateError)
                expect(() => objStore.deleteIndex("idx")).toThrow(
                    InvalidStateError,
                )
                expect(() => objStore.createIndex("idx2", "a")).toThrow(
                    InvalidStateError,
                )
            })
                .then(resolve)
                .catch(reject)
        })

        expect(addSuccess).toBe(true)
    })

    test("Attempting to remove an object store that does not exist should throw a NotFoundError", async ({
        task,
    }) => {
        await createDatabase(task, (db) => {
            expect(() => db.deleteObjectStore("whatever")).toThrow(
                NotFoundError,
            )
        })
    })

    test("Attempting to access an index that was deleted as part of object store deletion and then recreated using the same object store name should throw a NotFoundError", async ({
        task,
    }) => {
        const keys: IDBValidKey[] = []

        await new Promise<IDBDatabase>((resolve, reject) => {
            createDatabase(task, (db) => {
                const objStore = db.createObjectStore("resurrected", {
                    autoIncrement: true,
                    keyPath: "k",
                })

                objStore.add({ k: 5 }).onsuccess = function (e) {
                    keys.push((e.target as IDBRequest).result)
                }
                objStore.add({}).onsuccess = function (e) {
                    keys.push((e.target as IDBRequest).result)
                }
                objStore.createIndex("idx", "i")
                expect(objStore.indexNames.contains("idx")).toBe(true)
                expect(objStore.keyPath).toBe("k")

                db.deleteObjectStore("resurrected")

                const objStore2 = db.createObjectStore("resurrected", {
                    autoIncrement: true,
                })
                objStore2.add("Unicorns'R'us").onsuccess = function (e) {
                    keys.push((e.target as IDBRequest).result)
                }
                expect(objStore2.indexNames.contains("idx")).toBe(false)
                expect(objStore2.keyPath).toBe(null)

                expect(() => objStore2.index("idx")).toThrow(NotFoundError)
            })
                .then(resolve)
                .catch(reject)
        })

        expect(keys).toEqual([5, 6, 1])
    })
})
