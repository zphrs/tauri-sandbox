import { describe, expect, test } from "vitest"
import { createDatabase, requestToPromise } from "../resources/createDatabase"

// Port of w3c test: idbindex_keyPath.any.js
// Tests IDBIndex keyPath attribute functionality

describe("IDBIndex keyPath attribute", () => {
    test("returns the same object", async ({ task }) => {
        const db = await createDatabase(task, (db: IDBDatabase) => {
            const store = db.createObjectStore("store", { keyPath: ["a", "b"] })
            store.createIndex("index", ["a", "b"])
        })

        const tx = db.transaction("store", "readonly")
        const store = tx.objectStore("store")
        const index = store.index("index")

        expect(typeof index.keyPath).toBe("object")
        expect(Array.isArray(index.keyPath)).toBe(true)

        expect(index.keyPath).toBe(index.keyPath)

        const tx2 = db.transaction("store", "readonly")
        const store2 = tx2.objectStore("store")
        const index2 = store2.index("index")

        expect(index.keyPath).not.toBe(index2.keyPath)
    })

    test("array with a single value", async ({ task }) => {
        const db = await createDatabase(task, (db: IDBDatabase) => {
            const store = db.createObjectStore("store", { autoIncrement: true })
            store.createIndex("index", ["a"])
            store.add({ a: 1, b: 2, c: 3 })
        })

        const tx = db.transaction("store", "readonly")
        const store = tx.objectStore("store")
        const index = store.index("index")
        const cursorReq = index.openCursor()

        const cursor = await requestToPromise(cursorReq)
        expect(cursor).not.toBeNull()

        const expectedKeyValue = [1]
        const actualKeyValue = cursor?.key

        expect(actualKeyValue).toEqual(expectedKeyValue)
    })

    test("array with multiple values", async ({ task }) => {
        const db = await createDatabase(task, (db: IDBDatabase) => {
            const store = db.createObjectStore("store", { autoIncrement: true })
            store.createIndex("index", ["a", "b"])
            store.add({ a: 1, b: 2, c: 3 })
        })

        const tx = db.transaction("store", "readonly")
        const store = tx.objectStore("store")
        const index = store.index("index")
        const cursorReq = index.openCursor()

        const cursor = await requestToPromise(cursorReq)
        expect(cursor).not.toBeNull()

        const expectedKeyValue = [1, 2]
        const actualKeyValue = cursor?.key

        expect(actualKeyValue).toEqual(expectedKeyValue)
    })
})
