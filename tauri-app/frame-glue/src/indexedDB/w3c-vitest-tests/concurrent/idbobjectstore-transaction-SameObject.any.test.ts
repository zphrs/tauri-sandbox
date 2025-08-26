import { describe, test, expect } from "vitest"
import { createDatabase } from "../resources/createDatabase"

// Port of w3c test: idbobjectstore-transaction-SameObject.any.js
// Tests the [SameObject] behavior of IDBObjectStore's transaction attribute

describe("IDBObjectStore.transaction [SameObject]", () => {
    test("IDBObjectStore.transaction [SameObject]", async ({ task }) => {
        const db = await createDatabase(task, (database) => {
            const store = database.createObjectStore("store")
            expect(store.transaction).toBe(store.transaction)
        })

        const tx = db.transaction("store", "readonly")
        const store = tx.objectStore("store")
        expect(store.transaction).toBe(store.transaction)

        db.close()
    })
})
