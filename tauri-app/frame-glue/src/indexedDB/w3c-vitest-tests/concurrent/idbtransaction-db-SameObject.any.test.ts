import { describe, test, expect } from "vitest"
import { createDatabase } from "../resources/createDatabase"

// Port of w3c test: idbtransaction-db-SameObject.any.js
// Tests the [SameObject] behavior of IDBTransaction's db attribute

describe("IDBTransaction.db [SameObject]", () => {
    test("IDBTransaction.db [SameObject]", async ({ task }) => {
        const db = await createDatabase(task, (database, tx) => {
            database.createObjectStore("store")
            expect(tx.db).toBe(tx.db)
        })

        const tx = db.transaction("store", "readonly")
        expect(tx.db).toBe(tx.db)

        db.close()
    })
})
