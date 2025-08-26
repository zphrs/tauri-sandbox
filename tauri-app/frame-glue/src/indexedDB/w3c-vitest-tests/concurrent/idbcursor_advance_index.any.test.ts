import { describe, expect, test } from "vitest"
import { createDatabase, requestToPromise } from "../resources/createDatabase"
import { FDBKeyRange as IDBKeyRange } from "../../inMemoryIdb"

// Minimal port of w3c test: idbcursor_advance_index.any.js
// Exercises IDBCursor.advance() on an index

function upgradeFunc(db: IDBDatabase) {
    const objStore = db.createObjectStore("test")
    objStore.createIndex("index", "")

    objStore.add("cupcake", 5)
    objStore.add("pancake", 3)
    objStore.add("pie", 1)
    objStore.add("pie", 4)
    objStore.add("taco", 2)
}

describe("IDBCursor.advance() on index", () => {
    test("advances on index", async ({ task }) => {
        const db = await createDatabase(task, upgradeFunc)

        const tx = db.transaction("test", "readonly")
        const store = tx.objectStore("test")
        const index = store.index("index")
        const request = index.openCursor()

        let cursor: IDBCursorWithValue = (await requestToPromise(
            request,
        )) as IDBCursorWithValue

        const expectedValues = [
            { value: "cupcake", primaryKey: 5 },
            { value: "pie", primaryKey: 1 },
            { value: "taco", primaryKey: 2 },
        ]

        for (const expected of expectedValues) {
            expect(cursor).not.toBe(null)
            expect(cursor.value).toBe(expected.value)
            expect(cursor.primaryKey).toBe(expected.primaryKey)
            cursor.advance(2)

            cursor = (await requestToPromise(request)) as IDBCursorWithValue
        }
    })

    test("skip far forward on index", async ({ task }) => {
        const db = await createDatabase(task, upgradeFunc)

        const tx = db.transaction("test", "readonly")
        const store = tx.objectStore("test")
        const index = store.index("index")
        const request = index.openCursor()
        let cursor: IDBCursorWithValue = (await requestToPromise(request))!

        expect(cursor.value).toBe("cupcake")
        expect(cursor.primaryKey).toBe(5)

        cursor.advance(100000)

        cursor = (await requestToPromise(request))!
        expect(cursor).toBeNull()
    })

    test("advance within range on index", async ({ task }) => {
        const db = await createDatabase(task, upgradeFunc)

        const tx = db.transaction("test", "readonly")
        const store = tx.objectStore("test")
        const index = store.index("index")
        const request = index.openCursor(
            IDBKeyRange.lowerBound("cupcake", true),
        )

        let cursor: IDBCursorWithValue = (await requestToPromise(
            request,
        )) as IDBCursorWithValue

        const expectedValues = [
            { value: "pancake", primaryKey: 3 },
            { value: "pie", primaryKey: 4 },
        ]

        for (const expected of expectedValues) {
            expect(cursor).not.toBe(null)
            expect(cursor.value).toBe(expected.value)
            expect(cursor.primaryKey).toBe(expected.primaryKey)
            cursor.advance(2)

            cursor = (await requestToPromise(request)) as IDBCursorWithValue
        }

        expect(cursor).toBeNull()
    })
})
