import { describe, expect, test } from "vitest"
import { idb } from "../resources/createDatabase"
import type { FDBOpenDBRequest } from "../.."

// Port of w3c test: fire-upgradeneeded-event-exception.any.js
// Tests exception handling in upgradeneeded event handlers/listeners

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

// Helper function to create a test that fires an upgradeneeded event exception
function fireUpgradeneededEventTest(
    func: (open: FDBOpenDBRequest) => void,
    description: string,
) {
    return test(description, async () => {
        const dbName = "testdb-" + Date.now() + Math.random()

        // Delete the database first if it exists
        await new Promise<void>((resolve, reject) => {
            const del = idb.deleteDatabase(dbName)
            del.onerror = () =>
                reject(new Error("deleteDatabase should succeed"))
            del.onsuccess = () => resolve()
        })

        // Open database and expect error due to exception
        await new Promise<void>((resolve, reject) => {
            const open = idb.open(dbName, 1)
            let tx: { error?: { name: string } } | undefined

            open.onsuccess = () => {
                reject(new Error("open should fail"))
            }

            open.addEventListener("upgradeneeded", () => {
                tx = open.transaction as { error?: { name: string } }
            })

            func(open)

            open.addEventListener("error", () => {
                try {
                    expect(tx?.error?.name).toBe("AbortError")
                    resolve()
                } catch (err) {
                    reject(err as Error)
                }
            })
        })
    })
}

describe("fire-upgradeneeded-event-exception", () => {
    fireUpgradeneededEventTest((open) => {
        open.onupgradeneeded = () => {
            throw new Error()
        }
    }, "Exception in upgradeneeded handler")

    fireUpgradeneededEventTest((open) => {
        open.addEventListener("upgradeneeded", () => {
            throw new Error()
        })
    }, "Exception in upgradeneeded listener")

    fireUpgradeneededEventTest((open) => {
        open.addEventListener("upgradeneeded", {
            handleEvent() {
                throw new Error()
            },
        } as unknown as EventListener)
    }, 'Exception in upgradeneeded "handleEvent" lookup')

    fireUpgradeneededEventTest((open) => {
        open.addEventListener("upgradeneeded", {} as EventListener)
    }, 'Exception in upgradeneeded due to non-callable "handleEvent"')

    fireUpgradeneededEventTest((open) => {
        open.addEventListener("upgradeneeded", () => {
            // No-op.
        })
        open.addEventListener("upgradeneeded", () => {
            throw new Error()
        })
    }, "Exception in second upgradeneeded listener")

    fireUpgradeneededEventTest((open) => {
        let secondListenerCalled = false
        open.addEventListener("upgradeneeded", () => {
            open.result!.createObjectStore("s")
            throw new Error()
        })
        open.addEventListener("upgradeneeded", () => {
            secondListenerCalled = true
            expect(
                isTransactionActive(
                    open.transaction as unknown as IDBTransaction,
                    "s",
                ),
            ).toBe(true)
        })
        open.addEventListener("error", () => {
            expect(secondListenerCalled).toBe(true)
        })
    }, "Exception in first upgradeneeded listener, tx active in second")
})
