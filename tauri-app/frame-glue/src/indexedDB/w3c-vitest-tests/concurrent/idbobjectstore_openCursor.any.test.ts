import { describe, expect, test } from "vitest"
import { createDatabase, requestToPromise } from "../resources/createDatabase"

// Port of w3c test: idbobjectstore_openCursor.any.js
// Tests IDBObjectStore.openCursor() - iterate through 100 objects

describe("IDBObjectStore.openCursor()", () => {
    test("iterate through 100 objects", async ({ task }) => {
        const db = await createDatabase(task, (db) => {
            const store = db.createObjectStore("store")
            for (let i = 0; i < 100; i++) {
                store.add("record_" + i, i)
            }
        })

        const tx = db.transaction("store", "readonly")
        const store = tx.objectStore("store")
        const cursorRequest = store.openCursor()

        let count = 0
        let cursor = await requestToPromise(cursorRequest)

        while (cursor) {
            count += 1
            cursor.continue()
            cursor = await requestToPromise(cursorRequest)
        }

        expect(count).toBe(100)
    })
})
