import { describe, expect, test } from "vitest"
import { createDatabase, requestToPromise } from "../resources/createDatabase"

// Port of w3c test: idbcursor_continue_invalid.any.js
// Tests IDBCursor.continue() invalid usage

describe("IDBCursor.continue() invalid usage", () => {
    test("Attempt to call continue two times", async ({ task }) => {
        const db = await createDatabase(task, (database) => {
            const objStore = database.createObjectStore("test")
            objStore.createIndex("index", "")
            objStore.add("data", 1)
            objStore.add("data2", 2)
        })

        const tx = db.transaction("test", "readonly")
        const store = tx.objectStore("test")
        const index = store.index("index")
        const cursorRequest = index.openCursor()

        let count = 0
        let cursor = await requestToPromise(cursorRequest)

        while (cursor) {
            cursor.continue(undefined)

            // Second try - should throw InvalidStateError
            expect(() => {
                cursor!.continue()
            }).toThrow() // Should throw InvalidStateError

            expect(() => {
                cursor!.continue(3)
            }).toThrow() // Should throw InvalidStateError

            count++
            cursor = await requestToPromise(cursorRequest)
        }

        expect(count).toBe(2)
    })
})
