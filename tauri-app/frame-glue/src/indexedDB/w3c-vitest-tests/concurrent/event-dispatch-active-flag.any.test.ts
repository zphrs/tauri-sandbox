import { describe, test, expect, onTestFinished } from "vitest"
import { createDatabase, requestToPromise } from "../resources/createDatabase"
import { TransactionInactiveError } from "../../inMemoryIdb/lib/errors"

// Port of w3c test: event-dispatch-active-flag.any.js
// Tests that transaction active flag is set during event dispatch

// Helper functions ported from support.js
function isTransactionActive(tx: IDBTransaction, storeName: string): boolean {
    let promise: Promise<void>
    let out
    try {
        promise = requestToPromise(tx.objectStore(storeName).get(0))
        out = true
    } catch (e) {
        expect(e).toBeInstanceOf(TransactionInactiveError)
        out = false
    }
    onTestFinished(async () => {
        try {
            await promise
        } catch {
            // nothing
        }
    })
    return out
}

function createObjectStore() {
    return (db: IDBDatabase) => {
        db.createObjectStore("store")
    }
}

async function initializeTransaction(
    db: IDBDatabase,
    mode: IDBTransactionMode = "readonly",
) {
    const tx = db.transaction("store", mode)
    expect(isTransactionActive(tx, "store")).toBe(true)
    return tx
}

describe("event-dispatch-active-flag", () => {
    test("Active during success handlers", async ({ task }) => {
        const db = await createDatabase(task, createObjectStore())
        const tx = await initializeTransaction(db)

        await requestToPromise(tx.objectStore("store").get(0))

        await Promise.resolve()
        expect(isTransactionActive(tx, "store")).toBe(true)
        await new Promise((res) => setTimeout(res, 0))
        // Transaction should be inactive in next task
        expect(isTransactionActive(tx, "store")).toBe(false)
        await new Promise((res, rej) => {
            tx.oncomplete = res
            tx.onerror = () => rej(tx.error)
        })
    })

    test("Active during success listeners", async ({ task }) => {
        const db = await createDatabase(task, createObjectStore())
        const tx = await initializeTransaction(db)

        await requestToPromise(tx.objectStore("store").get(0))

        expect(isTransactionActive(tx, "store")).toBe(true)

        let sawPromise = false
        await Promise.resolve().then(() => {
            sawPromise = true
            // Transaction should still be active in microtasks
        })
        expect(isTransactionActive(tx, "store")).toBe(true)

        await new Promise((res) => setTimeout(res, 0))

        expect(sawPromise).toBe(true)
        expect(isTransactionActive(tx, "store")).toBe(false)
    })

    test("Active during error handlers", async ({ task }) => {
        const db = await createDatabase(task, createObjectStore())
        const tx = await initializeTransaction(db, "readwrite")

        await requestToPromise(tx.objectStore("store").put(0, 0))

        try {
            await requestToPromise(tx.objectStore("store").add(0, 0))
            expect.unreachable()
        } catch {
            expect(isTransactionActive(tx, "store")).toBe(true)
        }
        let sawPromise = false
        await Promise.resolve().then(() => {
            sawPromise = true
            // Transaction should still be active in microtasks
        })
        expect(isTransactionActive(tx, "store")).toBe(true)
        await new Promise((res) => setTimeout(res, 0))
        expect(sawPromise).toBe(true)
        // Transaction should be inactive in next task
        expect(isTransactionActive(tx, "store")).toBe(false)
    })

    test("Active during error listeners", async ({ task }) => {
        const db = await createDatabase(task, createObjectStore())
        const tx = await initializeTransaction(db, "readwrite")
        tx.objectStore("store").put(0, 0)
        try {
            await requestToPromise(tx.objectStore("store").add(0, 0))
            expect.unreachable("request should fail")
        } catch {
            expect(isTransactionActive(tx, "store")).toBe(true)
            await Promise.resolve()
            expect(isTransactionActive(tx, "store")).toBe(true)
            await new Promise((res) => setTimeout(res, 0))
            expect(isTransactionActive(tx, "store")).toBe(false)
        }
    })
})
