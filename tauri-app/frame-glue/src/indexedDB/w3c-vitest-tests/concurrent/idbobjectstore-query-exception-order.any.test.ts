import { describe, expect, test } from "vitest"
import { createDatabase, idb } from "../resources/createDatabase"
import {
    InvalidStateError,
    TransactionInactiveError,
} from "../../inMemoryIdb/lib/errors"

// Port of w3c test: idbobjectstore-query-exception-order.any.js
// Tests IDBObjectStore query method exception ordering

const methods = [
    "get",
    "getAll",
    "getAllKeys",
    "count",
    "openCursor",
    "openKeyCursor",
] as const

describe("IDBObjectStore query exception order", () => {
    methods.forEach((method) => {
        test(`InvalidStateError vs TransactionInactiveError for ${method}`, async () => {
            const dbName = `testdb-${Date.now()}-${Math.random()}`

            await new Promise<void>((resolve, reject) => {
                const openRequest = idb.open(dbName)

                openRequest.onupgradeneeded = () => {
                    const db = openRequest.result!
                    db.createObjectStore("s")
                    const store2 = db.createObjectStore("s2")

                    db.deleteObjectStore("s2")

                    setTimeout(() => {
                        try {
                            // "has been deleted" check (InvalidStateError) should precede
                            // "not active" check (TransactionInactiveError)
                            expect(() => {
                                ;(store2 as IDBObjectStore)[method]("key")
                            }).toThrow(InvalidStateError)
                            resolve()
                        } catch (error) {
                            reject(error)
                        }
                    }, 0)
                }

                openRequest.onsuccess = () => {
                    const db = openRequest.result!
                    db.close()
                    idb.deleteDatabase(dbName)
                }

                openRequest.onerror = () => {
                    reject(openRequest.error)
                }
            })
        })

        test(`TransactionInactiveError vs DataError for ${method}`, async ({
            task,
        }) => {
            const db = await createDatabase(task, (db) => {
                db.createObjectStore("s")
            })

            const tx = db.transaction("s", "readonly")
            const store = tx.objectStore("s")

            await new Promise((resolve) => setTimeout(resolve, 0))

            // "not active" check (TransactionInactiveError) should precede
            // query check (DataError)
            expect(() => {
                ;(store as IDBObjectStore)[method]({} as IDBValidKey)
            }).toThrow(TransactionInactiveError)
        })
    })
})
