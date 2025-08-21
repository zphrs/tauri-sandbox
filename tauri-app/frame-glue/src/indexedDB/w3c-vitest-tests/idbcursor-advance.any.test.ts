import { describe, expect, test } from "vitest"
import { createDatabase, requestToPromise } from "./resources/createDatabase"
import { FDBKeyRange as IDBKeyRange } from "../inMemoryIdb"

// Port of w3c test: idbcursor-advance.any.js
// Tests IDBCursor.advance() method functionality

function upgradeFunc(db: IDBDatabase) {
    const objStore = db.createObjectStore("test")
    objStore.createIndex("index", "")

    objStore.add("cupcake", 5)
    objStore.add("pancake", 3)
    objStore.add("pie", 1)
    objStore.add("pie", 4)
    objStore.add("taco", 2)
}

describe("IDBCursor.advance()", () => {
    test("advances", async ({ task }) => {
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
            console.log("PASSED", expected)

            cursor = (await requestToPromise(request)) as IDBCursorWithValue
        }
    })

    test("advances backwards", async ({ task }) => {
        const db = await createDatabase(task, upgradeFunc)

        const tx = db.transaction("test", "readonly")
        const store = tx.objectStore("test")
        const index = store.index("index")
        const request = index.openCursor(null, "prev")

        const expectedValues = [
            { value: "taco", primaryKey: 2 },
            { value: "pie", primaryKey: 1 },
            { value: "cupcake", primaryKey: 5 },
        ]
        for (const { value, primaryKey } of expectedValues) {
            const cursor = (await requestToPromise(request))!
            expect(cursor).not.toBeNull()
            expect(cursor?.value).toBe(value)
            expect(cursor?.primaryKey).toBe(primaryKey)
            cursor.advance(2)
        }
    })

    test("skip far forward", async ({ task }) => {
        const db = await createDatabase(task, upgradeFunc)

        const tx = db.transaction("test", "readonly")
        const store = tx.objectStore("test")
        const index = store.index("index")
        const cursorRequest = index.openCursor()
        let cursor: IDBCursorWithValue = (await requestToPromise(
            cursorRequest,
        ))!

        expect(cursor.value).toBe("cupcake")
        expect(cursor.primaryKey).toBe(5)

        cursor.advance(100000)

        cursor = (await requestToPromise(cursorRequest))!
        expect(cursor).toBeNull()
    })

    test("within range", async ({ task }) => {
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

    test("within single key range", async ({ task }) => {
        const db = await createDatabase(task, upgradeFunc)

        const tx = db.transaction("test", "readonly")
        const store = tx.objectStore("test")
        const index = store.index("index")
        const request = index.openCursor("pancake")

        const cursor = (await requestToPromise(request))!
        expect(cursor).not.toBeNull()

        expect(cursor.value).toBe("pancake")
        expect(cursor?.primaryKey).toBe(3)

        cursor.advance(1)
    })

    test("within single key range, with several results", async ({ task }) => {
        const db = await createDatabase(task, upgradeFunc)

        const tx = db.transaction("test", "readonly")
        const store = tx.objectStore("test")
        const index = store.index("index")
        const request = index.openCursor("pie")

        const expectedValues = [
            { value: "pie", primaryKey: 1 },
            { value: "pie", primaryKey: 4 },
        ]

        for (const expected of expectedValues) {
            const cursor = (await requestToPromise(request))!
            expect(cursor).not.toBeNull()
            expect(cursor.value).toBe(expected.value)
            expect(cursor.primaryKey).toBe(expected.primaryKey)
            cursor.advance(1)
        }

        const finalCursor = await requestToPromise(request)
        expect(finalCursor).toBeNull()
    })
})
