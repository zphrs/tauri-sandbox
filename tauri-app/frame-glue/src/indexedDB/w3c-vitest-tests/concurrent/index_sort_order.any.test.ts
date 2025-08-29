import { describe, test, expect } from "vitest"
import { createDatabase, requestToPromise } from "../resources/createDatabase"

// Port of w3c test: index_sort_order.any.js
// Tests IDBIndex key sort order

function upgradeFunc(db: IDBDatabase) {
    const d = new Date()
    const records = [{ foo: d }, { foo: "test" }, { foo: 1 }, { foo: 2.55 }]

    const objStore = db.createObjectStore("store", { autoIncrement: true })
    objStore.createIndex("index", "foo")

    for (let i = 0; i < records.length; i++) {
        objStore.add(records[i])
    }

    // Store the expected date value for later comparison
    ;(db as { _testDate?: Date })._testDate = d
}

describe("IDBIndex key sort order", () => {
    test("Verify IDBIndex key sort order is 'number < Date < DOMString'", async ({
        task,
    }) => {
        const db = await createDatabase(task, upgradeFunc)

        const testDate = (db as { _testDate?: Date })._testDate!
        const expectedKeyOrder = [1, 2.55, testDate.valueOf(), "test"]

        const tx = db.transaction("store", "readonly")
        const store = tx.objectStore("store")
        const index = store.index("index")
        const request = index.openCursor()

        const actualKeys: unknown[] = []

        while (true) {
            const cursor = await requestToPromise(request)
            if (!cursor) break

            actualKeys.push(cursor.key.valueOf())
            cursor.continue()
        }

        expect(actualKeys).toEqual(expectedKeyOrder)
    })
})
