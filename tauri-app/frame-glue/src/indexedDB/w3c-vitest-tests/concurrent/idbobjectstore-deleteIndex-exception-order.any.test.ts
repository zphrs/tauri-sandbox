import { describe, expect, test } from "vitest"
import { createDatabase, idb } from "../resources/createDatabase"
import {
    InvalidStateError,
    TransactionInactiveError,
} from "../../inMemoryIdb/lib/errors"

// Port of w3c test: idbobjectstore-deleteIndex-exception-order.any.js
// Tests IDBObjectStore deleteIndex() method exception ordering

describe("IDBObjectStore deleteIndex() Exception Ordering", () => {
    test("InvalidStateError #1 vs. TransactionInactiveError", async ({
        task,
    }) => {
        const db = await createDatabase(task, (db) => {
            const store = db.createObjectStore("s")
            store.createIndex("i", "keyPath")
        })

        const tx = db.transaction("s", "readonly")
        const store = tx.objectStore("s")

        await new Promise<void>((resolve) => {
            setTimeout(() => {
                resolve()
                resolve()
            }, 0)
        })
        // "running an upgrade transaction" check (InvalidStateError)
        // should precede "not active" check (TransactionInactiveError)
        expect(() => {
            store.deleteIndex("i")
        }).toThrow(InvalidStateError)
    })

    test("InvalidStateError #2 vs. TransactionInactiveError", async () => {
        const dbName = `testdb-${Date.now()}-${Math.random()}`

        await new Promise<void>((resolve, reject) => {
            const req = idb.open(dbName)

            req.onupgradeneeded = () => {
                const db = req.result
                const store = db.createObjectStore("s")
                store.createIndex("i", "keyPath")

                db.deleteObjectStore("s")

                setTimeout(() => {
                    try {
                        // "deleted" check (InvalidStateError) should precede
                        // "not active" check (TransactionInactiveError)
                        expect(() => {
                            store.deleteIndex("i")
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

    test("TransactionInactiveError vs. NotFoundError", async () => {
        const dbName = `testdb-${Date.now()}-${Math.random()}`

        await new Promise<void>((resolve, reject) => {
            const req = idb.open(dbName)

            req.onupgradeneeded = () => {
                const db = req.result
                const store = db.createObjectStore("s")

                setTimeout(() => {
                    try {
                        // "not active" check (TransactionInactiveError) should precede
                        // "name in store" check (NotFoundError)
                        expect(() => {
                            store.deleteIndex("nope")
                        }).toThrow(TransactionInactiveError)
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
})
