import { describe, expect, test } from "vitest"
import { createDatabase } from "../resources/createDatabase"

// Port of w3c test: idbrequest_error.any.js
// Tests IDBRequest.error property

describe("IDBRequest.error", () => {
    test("IDBRequest.error throws if ready state is pending", async ({
        task,
    }) => {
        const db = await createDatabase(task, (db) => {
            db.createObjectStore("store")
        })

        const tx = db.transaction("store", "readonly")
        const store = tx.objectStore("store")
        const request = store.get(0)

        expect(request.readyState).toBe("pending")
        expect(() => request.error).toThrow("InvalidStateError")
    })
})
