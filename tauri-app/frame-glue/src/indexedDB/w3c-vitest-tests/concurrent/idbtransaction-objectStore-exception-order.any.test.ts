import { describe, test, expect } from "vitest"
import { createDatabase } from "../resources/createDatabase"
import { InvalidStateError } from "../../inMemoryIdb/lib/errors"

// Port of w3c test: idbtransaction-objectStore-exception-order.any.js
// Tests IDBTransaction.objectStore() exception ordering

describe("IDBTransaction.objectStore exception order", () => {
    test("InvalidStateError vs. NotFoundError", async ({ task }) => {
        const db = await createDatabase(task, (database) => {
            database.createObjectStore("s")
        })

        const tx = db.transaction("s", "readonly")

        await new Promise<void>((resolve) => {
            tx.oncomplete = () => {
                resolve()
            }
        })
        // "finished" check (InvalidStateError) should precede
        // "name in scope" check (NotFoundError)
        expect(() => tx.objectStore("nope")).toThrow(InvalidStateError)

        db.close()
    })
})
