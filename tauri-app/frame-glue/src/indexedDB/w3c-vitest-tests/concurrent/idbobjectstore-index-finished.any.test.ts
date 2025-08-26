import { describe, expect, test } from "vitest"
import { createDatabase } from "../resources/createDatabase"
import { InvalidStateError } from "../../inMemoryIdb/lib/errors"

// Port of w3c test: idbobjectstore-index-finished.any.js
// Tests IDBObjectStore index() when transaction is finished

describe("IDBObjectStore index() when transaction is finished", () => {
    test("IDBObjectStore index() behavior when transaction is finished", async ({
        task,
    }) => {
        const db = await createDatabase(task, (db) => {
            const store = db.createObjectStore("store")
            store.createIndex("index", "key_path")
        })

        const tx = db.transaction("store", "readonly")
        const store = tx.objectStore("store")
        tx.abort()

        expect(() => {
            store.index("index")
        }).toThrow(InvalidStateError)
    })
})
