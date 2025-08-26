import { describe, expect, test } from "vitest"
import {
    createDatabase,
    migrateNamedDatabase,
} from "../resources/createDatabase"
import { NotFoundError } from "../../inMemoryIdb/lib/errors"

// Port of w3c test: idbobjectstore_deleteIndex.any.js
// Tests IDBObjectStore.deleteIndex() method functionality

describe("IDBObjectStore.deleteIndex()", () => {
    test("IDBObjectStore.deleteIndex() removes the index", async ({ task }) => {
        // Create initial database with index
        let db = await createDatabase(task, (db) => {
            const objStore = db.createObjectStore("test")
            objStore.createIndex("index", "indexedProperty")
        })

        db.close()

        // Upgrade database to delete the index
        db = await migrateNamedDatabase(task, db.name, 2, (_, tx) => {
            const objStore = tx.objectStore("test")
            objStore.deleteIndex("index")
        })

        // Verify index was removed
        const tx = db.transaction("test", "readonly")
        const objStore = tx.objectStore("test")

        expect(() => {
            objStore.index("index")
        }).toThrow(NotFoundError)
    })
})
