import { describe, expect, test } from "vitest"
import { createDatabase, requestToPromise } from "../resources/createDatabase"

// Port of w3c test: idbcursor-update-exception-order.any.js
// Tests IDBCursor.update() exception ordering

describe("IDBCursor.update exception order", () => {
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

        expect(() => cursor!.update("value2")).toThrow(
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

        // Continue cursor to make it invalid for update
        cursor!.continue()

        expect(() => cursor!.update("value2")).toThrow(
            /ReadOnlyError|mutating operation.*readonly/i,
        )
    })

    test(
        "ReadOnlyError vs. InvalidStateError #2",
        { timeout: 1000 },
        async ({ task }) => {
            const db = await createDatabase(task, (db) => {
                const s = db.createObjectStore("s")
                s.put("value", "key")
            })

            const s = db.transaction("s", "readonly").objectStore("s")
            const r = s.openKeyCursor()
            const cursor = await requestToPromise(r)

            expect(cursor).not.toBeNull()

            expect(() => cursor!.update("value2")).toThrow(
                /ReadOnlyError|mutating operation.*readonly/i,
            )
        },
    )

    test("InvalidStateError vs. DataError", async ({ task }) => {
        const db = await createDatabase(task, (db) => {
            const s = db.createObjectStore("s", { keyPath: "id" })
            s.put({ id: 123, data: "value" })
        })

        const s = db.transaction("s", "readwrite").objectStore("s")
        const r = s.openCursor()
        const cursor = await requestToPromise(r)

        expect(cursor).not.toBeNull()

        // Move cursor so update would be invalid for "got value" semantics
        cursor!.continue()

        expect(() => cursor!.update({ id: 123, data: "value2" })).toThrow(
            /InvalidStateError|Got value flag|InvalidStateError/i,
        )
    })
})
