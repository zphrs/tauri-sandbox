import { describe, test, expect } from "vitest"
import { createDatabase } from "../resources/createDatabase"
import { InvalidStateError } from "../../inMemoryIdb/lib/errors"

// Port of w3c test: idbtransaction-objectStore-finished.any.js
// Tests IDBTransaction.objectStore() when transaction is finished

describe("IDBTransaction objectStore() when transaction is finished", () => {
    test("objectStore() should throw if transaction is finished", async ({
        task,
    }) => {
        const db = await createDatabase(task, (database) => {
            database.createObjectStore("store")
        })

        const tx = db.transaction("store", "readonly")
        tx.abort()

        expect(() => tx.objectStore("store")).toThrow(InvalidStateError)

        db.close()
    })
})
