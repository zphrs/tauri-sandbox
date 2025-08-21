import { describe, expect, test } from "vitest"
import { idb } from "./resources/createDatabase"

// Port of w3c test: fire-success-event-exception.any.js
// Tests exception handling in success event handlers/listeners

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

// Helper function to create a test that fires a success event
function fireSuccessEventTest(
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
                const tx = db.transaction("s", "readonly")
                let txAborted = false

                tx.oncomplete = () => {
                    if (!txAborted) {
                        reject(new Error("transaction should abort"))
                    }
                }

                const store = tx.objectStore("s")
                const request = store.get(0) // This will succeed

                func(tx, request, db, resolve, reject)

                tx.addEventListener("abort", () => {
                    try {
                        expect(tx.error?.name).toBe("AbortError")
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

describe("fire-success-event-exception", () => {
    fireSuccessEventTest((_, request) => {
        request.onsuccess = () => {
            throw new Error()
        }
    }, "Exception in success event handler on request")

    fireSuccessEventTest((_, request) => {
        request.addEventListener("success", () => {
            throw new Error()
        })
    }, "Exception in success event listener on request")

    fireSuccessEventTest((_, request) => {
        request.addEventListener("success", {
            get handleEvent() {
                throw new Error()
            },
        } as unknown as EventListener)
    }, 'Exception in success event listener ("handleEvent" lookup) on request')

    fireSuccessEventTest((_, request) => {
        request.addEventListener("success", {
            handleEvent: null,
        } as unknown as EventListener)
    }, 'Exception in success event listener (non-callable "handleEvent") on request')

    fireSuccessEventTest((_, request) => {
        request.addEventListener("success", () => {
            // no-op
        })
        request.addEventListener("success", () => {
            throw new Error()
        })
    }, "Exception in second success event listener on request")

    fireSuccessEventTest((tx, request, _, __, reject) => {
        let secondListenerCalled = false
        request.addEventListener("success", () => {
            throw new Error()
        })
        request.addEventListener("success", () => {
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
    }, "Exception in first success event listener, tx active in second")
})
