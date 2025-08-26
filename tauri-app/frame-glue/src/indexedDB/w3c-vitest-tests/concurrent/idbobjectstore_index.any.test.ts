import { describe, expect, test } from "vitest"
import { createDatabase } from "../resources/createDatabase"
import { FDBIndex } from "../../inMemoryIdb"

// Port of w3c test: idbobjectstore_index.any.js
// Tests IDBObjectStore.index() method functionality

describe("IDBObjectStore.index()", () => {
    test("returns an index", async ({ task }) => {
        const db = await createDatabase(task, (db) => {
            db.createObjectStore("store").createIndex(
                "index",
                "indexedProperty",
            )
        })

        const index = db
            .transaction("store", "readonly")
            .objectStore("store")
            .index("index")

        expect(index).toBeInstanceOf(FDBIndex)
    })
})
