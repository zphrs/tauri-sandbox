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

        let count = 0

        return new Promise<void>((resolve, reject) => {
            request.onsuccess = (event) => {
                const cursor = (event.target as IDBRequest)
                    .result as IDBCursorWithValue | null

                if (!cursor) {
                    expect(count).toBe(3)
                    resolve()
                    return
                }

                // In reverse order starting from the end
                switch (count) {
                    case 0:
                        // Should start from "taco" (last in current order)
                        expect(cursor.value).toBe("taco")
                        expect(cursor.primaryKey).toBe(2)
                        break
                    case 1:
                        // After advance(2) backwards
                        expect(cursor.value).toBe("pie")
                        expect(cursor.primaryKey).toBe(1)
                        break
                    case 2:
                        // After advance(2) backwards
                        expect(cursor.value).toBe("cupcake")
                        expect(cursor.primaryKey).toBe(5)
                        break
                    default:
                        reject(new Error(`Unexpected count: ${count}`))
                        return
                }

                count++
                console.log(cursor.advance)
                cursor.advance(2)
            }

            request.onerror = () => {
                reject(new Error("Unexpected error"))
            }
        })
    })

    test("skip far forward", async ({ task }) => {
        const db = await createDatabase(task, upgradeFunc)

        const tx = db.transaction("test", "readonly")
        const store = tx.objectStore("test")
        const index = store.index("index")
        const cursorRequest = index.openCursor()
        let cursor: IDBCursorWithValue =
            (await requestToPromise(cursorRequest))!

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

        let count = 0

        return new Promise<void>((resolve, reject) => {
            request.onsuccess = (event) => {
                const cursor = (event.target as IDBRequest)
                    .result as IDBCursorWithValue | null

                if (!cursor) {
                    expect(count).toBe(1)
                    resolve()
                    return
                }

                switch (count) {
                    case 0:
                        expect(cursor.value).toBe("pancake")
                        expect(cursor.primaryKey).toBe(3)
                        break
                    default:
                        reject(new Error(`Unexpected count: ${count}`))
                        return
                }

                count++
                cursor.advance(1)
            }

            request.onerror = () => {
                reject(new Error("Unexpected error"))
            }
        })
    })

    test("within single key range, with several results", async ({ task }) => {
        const db = await createDatabase(task, upgradeFunc)

        const tx = db.transaction("test", "readonly")
        const store = tx.objectStore("test")
        const index = store.index("index")
        const request = index.openCursor("pie")

        let count = 0

        return new Promise<void>((resolve, reject) => {
            request.onsuccess = (event) => {
                const cursor = (event.target as IDBRequest)
                    .result as IDBCursorWithValue | null

                if (!cursor) {
                    expect(count).toBe(2)
                    resolve()
                    return
                }

                switch (count) {
                    case 0:
                        expect(cursor.value).toBe("pie")
                        expect(cursor.primaryKey).toBe(1)
                        break
                    case 1:
                        expect(cursor.value).toBe("pie")
                        expect(cursor.primaryKey).toBe(4)
                        break
                    default:
                        reject(new Error(`Unexpected count: ${count}`))
                        return
                }

                count++
                cursor.advance(1)
            }

            request.onerror = () => {
                reject(new Error("Unexpected error"))
            }
        })
    })
})
