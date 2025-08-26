import { describe, test, expect } from "vitest"
import { createDatabase } from "../resources/createDatabase"

// Port of w3c test: idbindex_indexNames.any.js
// Tests IDBObjectStore.indexNames property

describe("IDBObjectStore.indexNames", () => {
    test("Verify IDBObjectStore.indexNames property", async ({ task }) => {
        let upgradeStore: IDBObjectStore | undefined

        const db = await createDatabase(task, (db) => {
            const objStore = db.createObjectStore("test", { keyPath: "key" })
            objStore.createIndex("index", "data")

            upgradeStore = objStore

            expect(objStore.indexNames[0]).toBe("index")
            expect(objStore.indexNames.length).toBe(1)
        })

        const objStore = db.transaction("test", "readonly").objectStore("test")

        expect(objStore.indexNames[0]).toBe("index")
        expect(objStore.indexNames.length).toBe(1)

        // Verify that the index names are the same in both contexts
        expect(upgradeStore).toBeDefined()
        expect(upgradeStore!.indexNames[0]).toBe(objStore.indexNames[0])
        expect(upgradeStore!.indexNames.length).toBe(objStore.indexNames.length)
    })
})
