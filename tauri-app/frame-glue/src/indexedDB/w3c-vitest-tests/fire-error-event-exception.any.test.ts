import { describe, expect, test } from "vitest"
import { idb } from "./resources/createDatabase"

// Port of w3c test: fire-error-event-exception.any.js
// Tests exception handling in error event handlers/listeners

// Helper function to check if transaction is active
function isTransactionActive(tx: IDBTransaction, storeName: string): boolean {
    try {
        const request = tx.objectStore(storeName).get(0)
        request.onerror = (e) => {
            e.preventDefault()
            e.stopPropagation()
        }
        return true
    } catch (ex) {
        expect((ex as DOMException).name).toBe("TransactionInactiveError")
        return false
    }
}

// Helper function to create a test that fires an error event
function fireErrorEventTest(
    func: (
        tx: IDBTransaction,
        request: IDBRequest,
        db: IDBDatabase,
        resolve: () => void,
        reject: (error: Error) => void,
    ) => void,
    description: string,
) {
    return test(description, async () => {
        const dbName = "testdb-" + Date.now() + Math.random()

        // Setup database
        const setupRequest = idb.open(dbName, 1)
        await new Promise<void>((resolve, reject) => {
            setupRequest.onupgradeneeded = () => {
                const db = setupRequest.result
                db.createObjectStore("s")
            }
            setupRequest.onsuccess = () => resolve()
            setupRequest.onerror = () =>
                reject(new Error(setupRequest.error?.message))
        })

        // Run the actual test
        const openRequest = idb.open(dbName, 1)
        await new Promise<void>((resolve, reject) => {
            openRequest.onsuccess = () => {
                const db = openRequest.result
                const tx = db.transaction("s", "readwrite")
                let txAborted = false

                tx.oncomplete = () => {
                    if (!txAborted) {
                        reject(new Error("transaction should abort"))
                    }
                }

                const store = tx.objectStore("s")
                store.put(0, 0)
                const request = store.add(0, 0) // This should fail with ConstraintError

                request.onsuccess = () => {
                    reject(new Error("request should fail"))
                }

                func(tx, request, db, resolve, reject)

                tx.addEventListener("abort", () => {
                    try {
                        expect(tx.error?.name).toMatch(
                            /ConstraintError|AbortError/,
                        )
                        txAborted = true
                        resolve()
                    } catch (err) {
                        reject(err as Error)
                    }
                })
            }
            openRequest.onerror = () =>
                reject(new Error(openRequest.error?.message))
        })
    })
}

describe("fire-error-event-exception", () => {
    // Listeners on the request
    fireErrorEventTest((_, request) => {
        request.onerror = () => {
            throw new Error()
        }
    }, "Exception in error event handler on request")

    fireErrorEventTest((_, request) => {
        request.onerror = (e) => {
            e.preventDefault()
            throw new Error()
        }
    }, "Exception in error event handler on request, with preventDefault")

    fireErrorEventTest((_, request) => {
        request.addEventListener("error", () => {
            throw new Error()
        })
    }, "Exception in error event listener on request")

    fireErrorEventTest((_, request) => {
        request.addEventListener("error", {
            handleEvent() {
                throw new Error()
            },
        })
    }, 'Exception in error event listener ("handleEvent" lookup) on request')

    fireErrorEventTest((_, request) => {
        request.addEventListener("error", {} as EventListener)
    }, 'Exception in error event listener (non-callable "handleEvent") on request')

    fireErrorEventTest((_, request) => {
        request.addEventListener("error", () => {
            // no-op
        })
        request.addEventListener("error", () => {
            throw new Error()
        })
    }, "Exception in second error event listener on request")

    fireErrorEventTest((tx, request, _, __, reject) => {
        let secondListenerCalled = false
        request.addEventListener("error", () => {
            throw new Error()
        })
        request.addEventListener("error", () => {
            try {
                secondListenerCalled = true
                expect(isTransactionActive(tx, "s")).toBe(true)
            } catch (err) {
                reject(err as Error)
            }
        })
        tx.addEventListener("abort", () => {
            try {
                expect(secondListenerCalled).toBe(true)
            } catch (err) {
                reject(err as Error)
            }
        })
    }, "Exception in first error event listener on request, transaction active in second")

    // Listeners on the transaction
    fireErrorEventTest((tx) => {
        tx.onerror = () => {
            throw new Error()
        }
    }, "Exception in error event handler on transaction")

    fireErrorEventTest((tx) => {
        tx.onerror = (e) => {
            e.preventDefault()
            throw new Error()
        }
    }, "Exception in error event handler on transaction, with preventDefault")

    fireErrorEventTest((tx) => {
        tx.addEventListener("error", () => {
            throw new Error()
        })
    }, "Exception in error event listener on transaction")

    fireErrorEventTest((tx) => {
        tx.addEventListener("error", () => {
            // no-op
        })
        tx.addEventListener("error", () => {
            throw new Error()
        })
    }, "Exception in second error event listener on transaction")

    fireErrorEventTest((tx, _, __, ___, reject) => {
        let secondListenerCalled = false
        tx.addEventListener("error", () => {
            throw new Error()
        })
        tx.addEventListener("error", () => {
            try {
                secondListenerCalled = true
                expect(isTransactionActive(tx, "s")).toBe(true)
            } catch (err) {
                reject(err as Error)
            }
        })
        tx.addEventListener("abort", () => {
            try {
                expect(secondListenerCalled).toBe(true)
            } catch (err) {
                reject(err as Error)
            }
        })
    }, "Exception in first error event listener on transaction, transaction active in second")

    // Listeners on the connection
    fireErrorEventTest((_, __, db) => {
        db.onerror = () => {
            throw new Error()
        }
    }, "Exception in error event handler on connection")

    fireErrorEventTest((_, __, db) => {
        db.onerror = (e) => {
            e.preventDefault()
            throw new Error()
        }
    }, "Exception in error event handler on connection, with preventDefault")

    fireErrorEventTest((_, __, db) => {
        db.addEventListener("error", () => {
            throw new Error()
        })
    }, "Exception in error event listener on connection")

    fireErrorEventTest((_, __, db) => {
        db.addEventListener("error", () => {
            // no-op
        })
        db.addEventListener("error", () => {
            throw new Error()
        })
    }, "Exception in second error event listener on connection")

    fireErrorEventTest((tx, _, db, __, reject) => {
        let secondListenerCalled = false
        db.addEventListener("error", () => {
            throw new Error()
        })
        db.addEventListener("error", () => {
            try {
                secondListenerCalled = true
                expect(isTransactionActive(tx, "s")).toBe(true)
            } catch (err) {
                reject(err as Error)
            }
        })
        tx.addEventListener("abort", () => {
            try {
                expect(secondListenerCalled).toBe(true)
            } catch (err) {
                reject(err as Error)
            }
        })
    }, "Exception in first error event listener on connection, transaction active in second")
})
