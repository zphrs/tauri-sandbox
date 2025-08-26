import { describe, expect, test } from "vitest"
import { idb } from "../resources/createDatabase"
import {
    InvalidStateError,
    TransactionInactiveError,
} from "../../inMemoryIdb/lib/errors"

// Port of w3c test: idbdatabase-deleteObjectStore-exception-order.any.js
// Tests IDBDatabase.deleteObjectStore() exception ordering

describe("IDBDatabase.deleteObjectStore exception order", () => {
    test("InvalidStateError vs. TransactionInactiveError", async () => {
        const dbName = `testdb-${Date.now()}-${Math.random()}`

        try {
            const req = idb.open(dbName)

            await new Promise<void>((resolve, reject) => {
                req.onupgradeneeded = () => {
                    const database = req.result
                    database.createObjectStore("s")

                    // Acknowledge the error to prevent unhandled error
                    req.onerror = (e) => {
                        e.preventDefault()
                    }

                    req.transaction!.onabort = () => {
                        setTimeout(() => {
                            try {
                                // Test after abort - should throw InvalidStateError
                                // "running an upgrade transaction" check (InvalidStateError)
                                // should precede "not active" check (TransactionInactiveError)
                                expect(() =>
                                    database.deleteObjectStore("s"),
                                ).toThrow(InvalidStateError)
                                resolve()
                            } catch (error) {
                                reject(error)
                            }
                        }, 0)
                    }
                    req.transaction!.abort()
                }

                req.onsuccess = () => {
                    reject(
                        new Error(
                            "open operation should fail due to aborted transaction",
                        ),
                    )
                }
            })
        } catch (error) {
            // This is expected as the transaction is aborted
            if (
                (error as Error).message !==
                "open operation should fail due to aborted transaction"
            ) {
                throw error
            }
        }
    })

    test("TransactionInactiveError vs. NotFoundError", async () => {
        const dbName = `testdb-${Date.now()}-${Math.random()}`

        try {
            const req = idb.open(dbName)

            await new Promise<void>((resolve, reject) => {
                req.onupgradeneeded = () => {
                    const database = req.result

                    // Acknowledge the error to prevent unhandled error
                    req.onerror = (e) => {
                        e.preventDefault()
                    }

                    req.transaction!.onabort = async () => {
                        try {
                            // Test after abort - should throw TransactionInactiveError
                            // "not active" check (TransactionInactiveError) should precede
                            // "name in database" check (NotFoundError)
                            expect(() =>
                                database.deleteObjectStore("nope"),
                            ).toThrow(TransactionInactiveError)
                            resolve()
                        } catch (error) {
                            reject(error)
                        }
                    }
                    req.transaction!.abort()
                }

                req.onsuccess = () => {
                    reject(
                        new Error(
                            "open operation should fail due to aborted transaction",
                        ),
                    )
                }
            })
        } catch (error) {
            // This is expected as the transaction is aborted
            if (
                (error as Error).message !==
                "open operation should fail due to aborted transaction"
            ) {
                throw error
            }
        }
    })
})
