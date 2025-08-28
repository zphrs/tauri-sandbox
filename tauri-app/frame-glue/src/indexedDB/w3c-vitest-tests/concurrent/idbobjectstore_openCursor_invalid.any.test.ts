import { describe, expect, test } from "vitest"
import { createDatabase } from "../resources/createDatabase"
import { DataError } from "../../inMemoryIdb/lib/errors"

// Port of w3c test: idbobjectstore_openCursor_invalid.any.js
// Tests IDBObjectStore.openCursor() - invalid - pass something other than number

describe("IDBObjectStore.openCursor() - invalid", () => {
    test("pass something other than number", async ({ task }) => {
        const db = await createDatabase(task, (db) => {
            const objStore = db.createObjectStore("test")
            objStore.createIndex("index", "")

            objStore.add("data", 1)
            objStore.add("data2", 2)
        })

        const tx = db.transaction("test", "readonly")
        const store = tx.objectStore("test")
        const idx = store.index("index")

        expect(() => {
            idx.openCursor({ lower: "a" } as unknown as IDBKeyRange)
        }).toThrow(DataError)

        expect(() => {
            idx.openCursor({
                lower: "a",
                lowerOpen: false,
            } as unknown as IDBKeyRange)
        }).toThrow(DataError)

        expect(() => {
            idx.openCursor({
                lower: "a",
                lowerOpen: false,
                upper: null,
                upperOpen: false,
            } as unknown as IDBKeyRange)
        }).toThrow(DataError)
    })
})
