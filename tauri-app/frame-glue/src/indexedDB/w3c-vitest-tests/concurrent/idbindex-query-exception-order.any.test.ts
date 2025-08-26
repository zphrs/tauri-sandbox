import { describe, test, expect, onTestFinished } from "vitest"
import { createDatabase, idb } from "../resources/createDatabase"
import {
    InvalidStateError,
    TransactionInactiveError,
} from "../../inMemoryIdb/lib/errors"

// Port of w3c test: idbindex-query-exception-order.any.js
// Tests IDBIndex query method exception ordering

const methods = [
    "get",
    "getAll",
    "getAllKeys",
    "count",
    "openCursor",
    "openKeyCursor",
] as const

describe("IDBIndex query exception order", () => {
    methods.forEach((method) => {
        test(`InvalidStateError vs TransactionInactiveError for ${method}`, async () => {
            const dbName = `testdb-${Date.now()}-${Math.random()}`
            await new Promise<void>((resolve, reject) => {
                const openRequest = idb.open(dbName)
                openRequest.onupgradeneeded = () => {
                    const db = openRequest.result!
                    db.createObjectStore("s")
                    const s2 = db.createObjectStore("s2")
                    const index = s2.createIndex("i", "keyPath")
                    s2.deleteIndex("i")
                    setTimeout(() => {
                        try {
                            expect(() => index[method]("key")).toThrow(
                                InvalidStateError,
                            )
                            resolve()
                        } catch (error) {
                            reject(error)
                        }
                    }, 0)
                }
                openRequest.onsuccess = () => {
                    const db = openRequest.result!
                    onTestFinished(() => {
                        db.close()
                        idb.deleteDatabase(dbName)
                    })
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
                const store = db.createObjectStore("s")
                store.createIndex("i", "keyPath")
            })
            const tx = db.transaction("s", "readonly")
            const store = tx.objectStore("s")
            const index = store.index("i")
            await new Promise((res) => setTimeout(res, 0))
            // @ts-expect-error invalid key type for transaction inactive check
            expect(() => index[method]({})).toThrow(TransactionInactiveError)
        })
    })
})
