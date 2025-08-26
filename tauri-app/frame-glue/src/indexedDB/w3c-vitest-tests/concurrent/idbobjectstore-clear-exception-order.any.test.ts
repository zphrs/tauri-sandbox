import { describe, expect, test } from "vitest"
import { createDatabase, idb } from "../resources/createDatabase"
import {
    InvalidStateError,
    TransactionInactiveError,
} from "../../inMemoryIdb/lib/errors"

// Port of w3c test: idbobjectstore-clear-exception-order.any.js
// Tests IDBObjectStore clear() method exception ordering

describe("IDBObjectStore clear() Exception Ordering", () => {
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
                            store2.clear()
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
                    store.clear()
                }).toThrow(TransactionInactiveError)
                resolve()
            }, 0)
        })
    })
})
