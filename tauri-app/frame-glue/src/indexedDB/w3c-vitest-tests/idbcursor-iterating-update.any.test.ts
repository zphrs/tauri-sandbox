import { describe, expect, test } from "vitest"
import { createDatabase, requestToPromise } from "./resources/createDatabase"

// Port of w3c test: idbcursor-iterating-update.any.js
// Tests that cursor iteration is not affected by cursor updates/deletes

const objStoreValues = [
    { name: "foo", id: 1 },
    { name: "bar", id: 2 },
    { name: "foo", id: 3 },
    { name: "bar", id: 4 },
]

// Expected values when iterating by index "name" (sorted by name, then by primary key)
const objStoreValuesByIndex = [
    objStoreValues[1], // { name: "bar", id: 2 }
    objStoreValues[3], // { name: "bar", id: 4 }
    objStoreValues[0], // { name: "foo", id: 1 }
    objStoreValues[2], // { name: "foo", id: 3 }
]

function upgradeFunc(db: IDBDatabase) {
    const objStore = db.createObjectStore("items", {
        autoIncrement: true,
    })
    objStore.createIndex("name", "name", { unique: false })
    objStoreValues.forEach((value) => objStore.add(value))
}

describe("IDBCursor iterating with updates", () => {
    test("Calling cursor.update() doesn't affect index iteration", async ({
        task,
    }) => {
        const db = await createDatabase(task, upgradeFunc)

        const txn = db.transaction("items", "readwrite")
        const objStore = txn.objectStore("items")
        const nameIndex = objStore.index("name")

        const cursorValues: typeof objStoreValues = []
        const request = nameIndex.openCursor()

        while (true) {
            const cursor = await requestToPromise(request)
            if (!cursor) break

            cursor.update({}) // This should not affect iteration
            cursorValues.push(cursor.value)
            cursor.continue()
        }

        expect(cursorValues.length).toBe(4)
        cursorValues.forEach((value, i) => {
            expect(value).toEqual(objStoreValuesByIndex[i])
        })
    })

    test("Calling cursor.delete() doesn't affect index iteration", async ({
        task,
    }) => {
        const db = await createDatabase(task, upgradeFunc)

        const txn = db.transaction("items", "readwrite")
        const objStore = txn.objectStore("items")
        const nameIndex = objStore.index("name")

        const cursorValues: typeof objStoreValues = []
        const request = nameIndex.openCursor()

        while (true) {
            const cursor = await requestToPromise(request)
            if (!cursor) break

            cursor.delete() // This should not affect iteration
            cursorValues.push(cursor.value)
            cursor.continue()
        }

        expect(cursorValues.length).toBe(4)
        cursorValues.forEach((value, i) => {
            expect(value).toEqual(objStoreValuesByIndex[i])
        })
    })
})
