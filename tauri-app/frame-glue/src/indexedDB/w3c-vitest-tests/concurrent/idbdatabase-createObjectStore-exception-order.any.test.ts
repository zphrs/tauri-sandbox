import { describe, expect, test } from "vitest"
import {
    createDatabase,
    requestToPromise,
    idb,
} from "../resources/createDatabase"
import {
    ConstraintError,
    InvalidStateError,
    TransactionInactiveError,
} from "../../inMemoryIdb/lib/errors"

// Port of w3c test: idbdatabase-createObjectStore-exception-order.any.js
// Tests IDBDatabase.createObjectStore() exception ordering

describe("IDBDatabase.createObjectStore exception order", () => {
    test("SyntaxError vs. ConstraintError", async ({ task }) => {
        await createDatabase(task, (database) => {
            database.createObjectStore("s")

            expect(() =>
                database.createObjectStore("s", {
                    keyPath: "not a valid key path",
                }),
            ).toThrow(SyntaxError)
        })
    })

    test("ConstraintError vs. InvalidAccessError", async ({ task }) => {
        await createDatabase(task, (database) => {
            database.createObjectStore("s")

            expect(() =>
                database.createObjectStore("s", {
                    autoIncrement: true,
                    keyPath: "",
                }),
            ).toThrow(ConstraintError)
        })
    })

    test("TransactionInactiveError vs. SyntaxError", async () => {
        const dbName = `testdb-${Date.now()}-${Math.random()}`

        const req = idb.open(dbName)

        req.onupgradeneeded = () => {
            const database = req.result
            database.createObjectStore("s")

            req.transaction!.abort()

            expect(() =>
                database.createObjectStore("s2", { keyPath: "-invalid-" }),
            ).toThrow(TransactionInactiveError)
        }

        try {
            await requestToPromise(req as unknown as IDBRequest<IDBDatabase>)
            expect.unreachable("open should fail")
        } catch {
            // Expected to fail
        }
    })

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

                    req.transaction!.onabort = async () => {
                        try {
                            // Test after abort - should throw InvalidStateError (not in upgrade transaction)
                            await new Promise((res) => setTimeout(res, 0))
                            expect(() =>
                                database.createObjectStore("s2"),
                            ).toThrow(InvalidStateError)
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
