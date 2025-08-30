import { describe, expect, test } from "vitest"
import { createDatabase, requestToPromise } from "../resources/createDatabase"

// Port of w3c test: objectstore_keyorder.any.js
// Tests IDBObjectStore key sort order

function upgradeFunc(db: IDBDatabase) {
    const objStore = db.createObjectStore("store", { keyPath: "key" })

    const d = new Date()
    const records = [{ key: d }, { key: "test" }, { key: 1 }, { key: 2.55 }]

    for (let i = 0; i < records.length; i++) {
        objStore.add(records[i])
    }

    return d
}

describe("IDBObjectStore key sort order", () => {
    test("Verify key sort order in an object store is 'number < Date < DOMString'", async ({
        task,
    }) => {
        let testDate: Date
        const db = await createDatabase(task, (db) => {
            testDate = upgradeFunc(db)
        })

        const expectedKeyOrder = [1, 2.55, testDate!.valueOf(), "test"]

        const tx = db.transaction("store", "readonly")
        const store = tx.objectStore("store")
        const request = store.openCursor()

        const actual_keys: (number | string)[] = []

        while (true) {
            const cursor = await requestToPromise(request)
            if (cursor) {
                const keyValue =
                    cursor.key instanceof Date
                        ? cursor.key.valueOf()
                        : cursor.key
                actual_keys.push(keyValue as number | string)
                cursor.continue()
            } else {
                break
            }
        }

        expect(actual_keys).toEqual(expectedKeyOrder)
    })
})
