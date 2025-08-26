import { describe, test, expect } from "vitest"
import { createDatabase } from "../resources/createDatabase"

// Port of w3c test: idbindex-getAll-enforcerange.any.js
// Tests that IDBIndex.getAll() enforces valid range constraints

describe("IDBIndex.getAll() enforce range", () => {
    test("getAll with invalid count should throw TypeError", async ({
        task,
    }) => {
        const db = await createDatabase(task, (db) => {
            const store = db.createObjectStore("store")
            store.createIndex("index", "keyPath")
        })

        const tx = db.transaction("store", "readonly")
        const store = tx.objectStore("store")
        const index = store.index("index")

        const invalidCounts = [
            NaN,
            Infinity,
            -Infinity,
            -1,
            -Number.MAX_SAFE_INTEGER,
        ]
        invalidCounts.forEach((count) => {
            expect(() => {
                index.getAll(null, count)
            }).toThrowError(TypeError)
        })
    })
})
