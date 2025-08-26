import { describe, expect, test } from "vitest"
import { createDatabase, idb } from "../resources/createDatabase"
import {
    InvalidStateError,
    TransactionInactiveError,
    ReadOnlyError,
} from "../../inMemoryIdb/lib/errors"

// Port of w3c test: idbobjectstore-delete-exception-order.any.js
// Tests IDBObjectStore delete() method exception ordering

describe("IDBObjectStore delete() Exception Ordering", () => {
    test("InvalidStateError vs. TransactionInactiveError", async () => {
        const dbName = `testdb-${Date.now()}-${Math.random()}`

        await new Promise<void>((resolve, reject) => {
            const req = idb.open(dbName)

            req.onupgradeneeded = () => {
                const db = req.result
                db.createObjectStore("s")
                const store2 = db.createObjectStore("s2")

                db.deleteObjectStore("s2")

                setTimeout(() => {
                    try {
                        // "has been deleted" check (InvalidStateError) should precede
                        // "not active" check (TransactionInactiveError)
                        expect(() => {
                            store2.delete("key")
                        }).toThrow(InvalidStateError)
                        resolve()
                    } catch (error) {
                        reject(error)
                    }
                }, 0)
            }

            req.onsuccess = () => {
                // Should not reach here due to timeout test
                reject(new Error("Should not succeed"))
            }

            req.onerror = () => {
                reject(req.error)
            }
        })
    })

    test("TransactionInactiveError vs. ReadOnlyError", async ({ task }) => {
        const db = await createDatabase(task, (db) => {
            db.createObjectStore("s")
        })

        const tx = db.transaction("s", "readonly")
        const store = tx.objectStore("s")

        await new Promise<void>((resolve) => {
            setTimeout(() => {
                // "not active" check (TransactionInactiveError) should precede
                // "read only" check (ReadOnlyError)
                expect(() => {
                    store.delete("key")
                }).toThrow(TransactionInactiveError)
                resolve()
            }, 0)
        })
    })

    test("ReadOnlyError vs. DataError", async ({ task }) => {
        const db = await createDatabase(task, (db) => {
            db.createObjectStore("s")
        })

        const tx = db.transaction("s", "readonly")
        const store = tx.objectStore("s")

        // "read only" check (ReadOnlyError) should precede
        // key/data check (DataError)
        expect(() => {
            // Using object as key to trigger DataError
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            store.delete({} as any)
        }).toThrow(ReadOnlyError)
    })
})
