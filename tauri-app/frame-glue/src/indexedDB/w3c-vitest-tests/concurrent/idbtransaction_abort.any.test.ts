import { describe, test, expect } from "vitest"
import { createDatabase, idb } from "../resources/createDatabase"
import { InvalidStateError } from "../../inMemoryIdb/lib/errors"

// Port of w3c test: idbtransaction_abort.any.js
// Tests IDBTransaction - abort

describe("IDBTransaction - abort", () => {
    test("Abort event should fire during transaction", async ({ task }) => {
        const dbName = `testdb-${task.id}-${Date.now()}`
        let aborted = false
        const record = { indexedProperty: "bar" }

        const openReq = idb.open(dbName)

        await new Promise<void>((resolve, reject) => {
            openReq.onupgradeneeded = (e) => {
                const db = (e.target as IDBOpenDBRequest).result
                const txn = (e.target as IDBOpenDBRequest).transaction!
                const objStore = db.createObjectStore("store")
                objStore.add(record, 1)
                objStore.add(record, 2)
                const index = objStore.createIndex("index", "indexedProperty", {
                    unique: true,
                })

                expect(index).toBeInstanceOf(Object) // IDBIndex

                txn.onabort = (e) => {
                    aborted = true
                    expect(e.type).toBe("abort")
                }

                db.onabort = () => {
                    expect(aborted).toBe(true)
                    resolve()
                }

                txn.oncomplete = () => {
                    reject(new Error("got complete, expected abort"))
                }
            }

            openReq.onerror = reject
        })

        // Cleanup
        await new Promise<void>((resolve) => {
            const deleteReq = idb.deleteDatabase(dbName)
            deleteReq.onsuccess = () => resolve()
            deleteReq.onerror = () => resolve()
        })
    })

    test("Abort during auto-committing should throw InvalidStateError", async ({
        task,
    }) => {
        const db = await createDatabase(task, (database) => {
            database.createObjectStore("blobs", {
                keyPath: "id",
                autoIncrement: true,
            })
        })

        const txn = db.transaction("blobs", "readwrite")
        const objectStore = txn.objectStore("blobs")
        const data = new Blob(["test"], { type: "text/plain" })

        const putRequest = objectStore.put({ id: 0, data: data })

        await new Promise<void>((resolve, reject) => {
            txn.oncomplete = () => resolve()

            txn.onabort = (event) => {
                reject(
                    new Error(
                        "Unexpected transaction abort: " +
                            String((event.target as IDBTransaction)?.error),
                    ),
                )
            }

            putRequest.onerror = reject
        })

        await new Promise((res) => setTimeout(res, 0))
        expect(() => txn.abort()).toThrow(InvalidStateError)

        db.close()
    })

    test("Abort on completed transaction should throw InvalidStateError", async ({
        task,
    }) => {
        const db = await createDatabase(task, (database) => {
            database.createObjectStore("blobs", {
                keyPath: "id",
                autoIncrement: true,
            })
        })

        const txn = db.transaction("blobs", "readwrite")
        const objectStore = txn.objectStore("blobs")
        const data = new Blob(["test"], { type: "text/plain" })

        objectStore.put({ id: 0, data: data })

        await new Promise<void>((resolve, reject) => {
            txn.oncomplete = () => {
                expect(() => txn.abort()).toThrow(InvalidStateError)
                resolve()
            }

            txn.onerror = (event) => {
                reject(
                    new Error(
                        "Unexpected transaction error: " +
                            String((event.target as IDBTransaction)?.error),
                    ),
                )
            }
        })

        db.close()
    })
})
