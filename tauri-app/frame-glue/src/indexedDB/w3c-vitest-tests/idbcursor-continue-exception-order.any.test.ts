import { describe, expect, test } from "vitest"
import { createDatabase, requestToPromise } from "./resources/createDatabase"

// Port of w3c test: idbcursor-continue-exception-order.any.js
// Tests exception ordering for IDBCursor.continue() method

function upgradeFunc(db: IDBDatabase) {
    const s = db.createObjectStore("s")
    s.put("value1", "key1")
    s.put("value2", "key2")
    s.put("value3", "key3")
}

describe("IDBCursor.continue exception order", () => {
    test("TransactionInactiveError vs. DataError", async ({ task }) => {
        const db = await createDatabase(task, upgradeFunc)

        const s = db.transaction("s", "readonly").objectStore("s")
        const r = s.openKeyCursor()
        const cursor = (await requestToPromise(r)) as IDBCursor

        // Wait for the transaction to become inactive
        await new Promise((resolve) => setTimeout(resolve, 0))

        expect(() => {
            cursor.continue({ not: "a valid key" } as unknown as IDBValidKey)
        }).toThrow(/TransactionInactiveError|Transaction|inactive/i)
    })

    test("TransactionInactiveError vs. InvalidStateError", async ({ task }) => {
        const db = await createDatabase(task, upgradeFunc)

        const s = db.transaction("s", "readonly").objectStore("s")
        const r = s.openKeyCursor()
        let cursor = (await requestToPromise(r)) as IDBCursor

        // Advance cursor to set the "got value flag"
        cursor.continue()
        const nextCursorResult = await requestToPromise(r)

        // If cursor has reached the end, we can't test this scenario
        if (nextCursorResult === null) {
            // Skip this test scenario since there's no second record
            return
        }

        cursor = nextCursorResult

        // Wait for the transaction to become inactive
        await new Promise((resolve) => setTimeout(resolve, 0))

        expect(() => {
            cursor.continue()
        }).toThrow(/TransactionInactiveError|Transaction|inactive/i)
    })

    test("InvalidStateError vs. DataError", async ({ task }) => {
        const db = await createDatabase(task, upgradeFunc)

        const s = db.transaction("s", "readonly").objectStore("s")
        const r = s.openKeyCursor()
        const cursor = (await requestToPromise(r)) as IDBCursor

        // Call continue() to set the "got value flag"
        cursor.continue()

        // This should throw InvalidStateError before checking the invalid key
        expect(() => {
            cursor.continue({ not: "a valid key" } as unknown as IDBValidKey)
        }).toThrow(/InvalidStateError|InvalidState|got value flag/i)
    })
})
