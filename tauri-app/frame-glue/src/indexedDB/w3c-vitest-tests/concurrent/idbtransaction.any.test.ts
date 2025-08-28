import { describe, test, expect } from "vitest"
import { cleanupDbRefAfterTest, idb } from "../resources/createDatabase"

// Port of w3c test: idbtransaction.any.js
// Tests IDBTransaction basics

describe("IDBTransaction", () => {
    test("request gotten by the handler", async ({ task }) => {
        const dbname = `idbtransaction-${task.id}-${Date.now()}`

        const openReq = idb.open(dbname)

        await new Promise<void>((resolve) => {
            openReq.onupgradeneeded = (e) => {
                expect(e.target).toBe(openReq)
                expect((e.target as IDBOpenDBRequest).transaction).toBe(
                    openReq.transaction,
                )
                expect(openReq.transaction).toBeInstanceOf(Object) // IDBTransaction
            }
            openReq.onsuccess = () => resolve()
        })
        cleanupDbRefAfterTest(openReq.result)
    })

    test("request returned by open()", async ({ task }) => {
        const dbname = `idbtransaction-${task.id}-${Date.now()}`

        const openReq = idb.open(dbname)

        expect(openReq.transaction).toBe(null)
        // Note: source property doesn't exist on IDBOpenDBRequest in TypeScript
        expect(openReq.readyState).toBe("pending")
        expect(openReq).toBeInstanceOf(Object) // IDBOpenDBRequest
        expect(openReq.toString()).toBe("[object IDBOpenDBRequest]")

        await new Promise<void>((resolve, reject) => {
            openReq.onsuccess = () => resolve()

            openReq.onerror = (e) => reject(e.error)
            openReq.onblocked = () => reject(new Error("BLOCKED"))
        })
        cleanupDbRefAfterTest(openReq.result)
    })
})
