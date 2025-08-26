import { describe, test, expect } from "vitest"
import { createDatabase } from "../resources/createDatabase"

// Port of w3c test: idbindex-objectStore-SameObject.any.js
// Tests that IDBIndex.objectStore returns the same object each time

describe("IDBIndex.objectStore should return same object each time", () => {
    test("attribute same in upgrade handler", async ({ task }) => {
        await createDatabase(task, (db) => {
            const store = db.createObjectStore("store")
            const index = store.createIndex("index", "keyPath")
            expect(index.objectStore).toBe(index.objectStore)
        })
    })

    test("attribute same in transaction", async ({ task }) => {
        const db = await createDatabase(task, (db) => {
            const store = db.createObjectStore("store")
            store.createIndex("index", "keyPath")
        })
        const tx = db.transaction("store", "readonly")
        const store = tx.objectStore("store")
        const index = store.index("index")
        expect(index.objectStore).toBe(index.objectStore)
    })
})
