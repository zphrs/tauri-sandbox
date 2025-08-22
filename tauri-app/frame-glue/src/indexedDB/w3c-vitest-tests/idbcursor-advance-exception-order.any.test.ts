import { describe, expect, test, onTestFinished } from "vitest"
import {
    createDatabase,
    requestToPromise,
    idb,
} from "./resources/createDatabase"

// Port of w3c test: idbcursor-advance-exception-order.any.js
// Tests the exception ordering for IDBCursor.advance() method

describe("IDBCursor advance() Exception Ordering", () => {
    test("TypeError vs. TransactionInactiveError", async ({ task }) => {
        const db = await createDatabase(task, (db) => {
            const store = db.createObjectStore("s")
            store.put("value", "key")
        })

        const tx = db.transaction("s", "readonly")
        const store = tx.objectStore("s")

        const request = store.openKeyCursor()
        const cursor = await requestToPromise<IDBCursor | null>(request)

        expect(cursor).not.toBeNull()

        // Wait for transaction to become inactive
        await new Promise<void>((resolve) => {
            setTimeout(() => {
                // "zero" check (TypeError) should precede "not active" check (TransactionInactiveError)
                expect(() => {
                    cursor!.advance(0)
                }).toThrow(TypeError)
                resolve()
            }, 0)
        })
    })

    test("TransactionInactiveError vs. InvalidStateError #1", async () => {
        // This test matches the original w3c test: create object stores in upgrade,
        // open cursor, delete object store, then test exception order after timeout
        const dbName = "testdb-" + Date.now() + Math.random()

        await new Promise<void>((resolve, reject) => {
            let cursor: IDBCursor | null = null

            const openRequest = idb.open(dbName, 1)

            openRequest.onupgradeneeded = () => {
                const db = openRequest.result!

                // Create both object stores
                db.createObjectStore("s")
                const s2 = db.createObjectStore("s2")

                // Put data and open cursor
                s2.put("value", "key")
                const cursorRequest = s2.openKeyCursor()

                cursorRequest.onsuccess = () => {
                    cursor = cursorRequest.result!
                    expect(cursor).not.toBeNull()

                    // Delete the object store while cursor is still active
                    db.deleteObjectStore("s2")

                    // Wait for transaction to become inactive, then test exception order
                    setTimeout(() => {
                        try {
                            // "not active" check (TransactionInactiveError) should precede
                            // "deleted" check (InvalidStateError)
                            expect(() => {
                                cursor!.advance(1)
                            }).toThrow(DOMException)
                            expect(() => {
                                cursor!.advance(1)
                            }).toThrow(/TransactionInactiveError/)
                            resolve()
                        } catch (error) {
                            reject(error)
                        }
                    }, 0)
                }

                cursorRequest.onerror = () => {
                    reject(cursorRequest.error)
                }
            }

            openRequest.onsuccess = () => {
                // Clean up
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

    test("TransactionInactiveError vs. InvalidStateError #2", async ({
        task,
    }) => {
        const db = await createDatabase(task, (db) => {
            const store = db.createObjectStore("s")
            store.put("value", "key")
        })

        const tx = db.transaction("s", "readonly")
        const store = tx.objectStore("s")

        const request = store.openKeyCursor()
        const cursor = await requestToPromise<IDBCursor | null>(request)

        expect(cursor).not.toBeNull()

        // Advance cursor once to make it invalid for further advances
        cursor!.advance(1)

        await new Promise((res) => setTimeout(res, 0))

        try {
            cursor!.advance(1)
            expect.unreachable()
        } catch (e) {
            expect((e as DOMException).name).toBe("TransactionInactiveError")
        }
    })
})
