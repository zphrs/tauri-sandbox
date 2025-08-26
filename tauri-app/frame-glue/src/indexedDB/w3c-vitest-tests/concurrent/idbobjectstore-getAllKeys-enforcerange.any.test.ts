import { describe, test, expect } from "vitest"
import { createDatabase } from "../resources/createDatabase"

// Port of w3c test: idbobjectstore-getAllKeys-enforcerange.any.js
// Tests that IDBObjectStore.getAllKeys() enforces valid range constraints

describe("IDBObjectStore.getAllKeys() enforce range", () => {
    test("getAllKeys with invalid count should throw TypeError", async ({
        task,
    }) => {
        const db = await createDatabase(task, (db) => {
            db.createObjectStore("store")
        })

        const tx = db.transaction("store", "readonly")
        const store = tx.objectStore("store")

        const invalidCounts = [
            NaN,
            Infinity,
            -Infinity,
            -1,
            -Number.MAX_SAFE_INTEGER,
        ]
        invalidCounts.forEach((count) => {
            expect(() => {
                store.getAllKeys(null, count)
            }).toThrowError(TypeError)
        })
    })
})
