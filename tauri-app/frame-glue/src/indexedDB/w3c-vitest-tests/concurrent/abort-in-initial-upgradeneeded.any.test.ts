import { describe, expect, test } from "vitest"
import { idb } from "../resources/createDatabase"

// Port of w3c test: abort-in-initial-upgradeneeded.any.js
// Tests that an abort() in the initial onupgradeneeded sets version back to 0

describe("abort-in-initial-upgradeneeded", () => {
    test(
        "An abort() in the initial onupgradeneeded sets version back to 0",
        { timeout: 1000 },
        async ({ task }) => {
            const dbname =
                task.id || "testdb-" + new Date().getTime() + Math.random()

            let db: IDBDatabase
            let transaction: IDBTransaction
            const open_rq = idb.open(dbname, 2)

            // Promise for handling the upgrade needed event and setting up abort
            const upgradeAndAbortPromise = new Promise<void>(
                (resolve, reject) => {
                    open_rq.onupgradeneeded = function (e) {
                        db = (e.target as IDBOpenDBRequest).result
                        expect(db.version).toBe(2)

                        transaction = (e.target as IDBOpenDBRequest)
                            .transaction!

                        // Set up transaction handlers
                        setupTransactionHandlers(transaction)

                        db.onabort = function () {
                            resolve()
                        }

                        // Abort the transaction
                        transaction.abort()
                    }

                    open_rq.onsuccess = () => {
                        reject(new Error("unexpected success"))
                    }
                },
            )

            // Promise for handling the open request error
            const errorPromise = new Promise<void>((resolve) => {
                open_rq.onerror = function (e) {
                    expect(open_rq).toBe(e.target)
                    expect(
                        (e.target as IDBOpenDBRequest).result,
                    ).toBeUndefined()
                    expect((e.target as IDBOpenDBRequest).error?.name).toBe(
                        "AbortError",
                    )
                    expect(db.version).toBe(0)
                    expect(open_rq.transaction).toBeNull()
                    resolve()
                }
            })

            function setupTransactionHandlers(txn: IDBTransaction) {
                txn.oncomplete = () => {
                    throw new Error("unexpected transaction.complete")
                }

                txn.onabort = function (e) {
                    expect((e.target as IDBTransaction).db.version).toBe(0)
                }
            }

            // Wait for upgrade to complete and abort to be triggered
            await upgradeAndAbortPromise

            // Wait for the error to be handled
            await errorPromise
        },
    )
})
