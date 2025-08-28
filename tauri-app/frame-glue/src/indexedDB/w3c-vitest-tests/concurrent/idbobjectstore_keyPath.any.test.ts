import { describe, test, expect } from "vitest"
import { createDatabase } from "../resources/createDatabase"

// Port of w3c test: idbobjectstore_keyPath.any.js
// Tests IDBObjectStore keyPath attribute - same object

describe("IDBObjectStore keyPath attribute", () => {
    test("returns the same object", async ({ task }) => {
        const db = await createDatabase(task, (db: IDBDatabase) => {
            db.createObjectStore("store", { keyPath: ["a", "b"] })
        })

        const tx = db.transaction("store", "readonly")
        const store = tx.objectStore("store")

        expect(typeof store.keyPath).toBe("object")
        expect(Array.isArray(store.keyPath)).toBe(true)

        expect(store.keyPath).toBe(store.keyPath)

        const tx2 = db.transaction("store", "readonly")
        const store2 = tx2.objectStore("store")

        expect(store.keyPath).not.toBe(store2.keyPath)

        db.close()
    })
})
