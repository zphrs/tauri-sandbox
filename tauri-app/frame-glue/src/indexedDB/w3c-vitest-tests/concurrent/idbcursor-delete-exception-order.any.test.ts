import { describe, test, expect } from "vitest"
import { createDatabase, requestToPromise } from "../resources/createDatabase"

// Port of w3c test: idbcursor-delete-exception-order.any.js
// Tests IDBCursor.delete() exception ordering

describe("IDBCursor.delete exception order", () => {
    test("TransactionInactiveError vs. ReadOnlyError", async ({ task }) => {
        const db = await createDatabase(task, (db) => {
            const s = db.createObjectStore("s")
            s.put("value", "key")
        })

        const s = db.transaction("s", "readonly").objectStore("s")
        const r = s.openCursor()
        const cursor = await requestToPromise(r)

        expect(cursor).not.toBeNull()

        // Wait for next task to make transaction inactive
        await new Promise((resolve) => setTimeout(resolve, 0))

        expect(() => cursor!.delete()).toThrow(
            /TransactionInactiveError|A request was placed against a transaction.*not active/i,
        )
    })

    test("ReadOnlyError vs. InvalidStateError #1", async ({ task }) => {
        const db = await createDatabase(task, (db) => {
            const s = db.createObjectStore("s")
            s.put("value", "key")
        })

        const s = db.transaction("s", "readonly").objectStore("s")
        const r = s.openCursor()
        const cursor = await requestToPromise(r)

        expect(cursor).not.toBeNull()

        // Continue cursor to make it invalid for delete
        cursor!.continue()

        expect(() => cursor!.delete()).toThrow(
            /ReadOnlyError|mutating operation.*readonly/i,
        )
    })

    test("ReadOnlyError vs. InvalidStateError #2", async ({ task }) => {
        const db = await createDatabase(task, (db) => {
            const s = db.createObjectStore("s")
            s.put("value", "key")
        })

        const s = db.transaction("s", "readonly").objectStore("s")
        const r = s.openKeyCursor()
        const cursor = await requestToPromise(r)

        expect(cursor).not.toBeNull()

        expect(() => cursor!.delete()).toThrow(
            /ReadOnlyError|mutating operation.*readonly/i,
        )
    })
})
