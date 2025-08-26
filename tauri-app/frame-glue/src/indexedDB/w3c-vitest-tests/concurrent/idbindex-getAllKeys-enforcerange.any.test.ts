import { describe, expect, test } from "vitest"
import { createDatabase } from "../resources/createDatabase"

// Port of w3c test: idbindex-getAllKeys-enforcerange.any.js
// Tests IDBIndex.getAllKeys() method enforces valid range constraints

describe("IDBIndex.getAllKeys()", () => {
    test("enforces valid range constraints", async ({ task }) => {
        const db = await createDatabase(task, (db) => {
            const store = db.createObjectStore("store")
            store.createIndex("index", "keyPath")
        })

        const tx = db.transaction("store", "readonly")
        const index = tx.objectStore("store").index("index")
        const invalidCounts = [
            NaN,
            Infinity,
            -Infinity,
            -1,
            -Number.MAX_SAFE_INTEGER,
        ]
        for (const count of invalidCounts) {
            expect(() => index.getAllKeys(null, count)).toThrow(TypeError)
        }
    })
})
