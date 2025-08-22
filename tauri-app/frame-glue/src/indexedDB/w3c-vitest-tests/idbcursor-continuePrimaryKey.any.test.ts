import { describe, expect, test } from "vitest"
import { createDatabase, requestToPromise } from "./resources/createDatabase"

// Port of w3c test: idbcursor-continuePrimaryKey.any.js
// Tests IDBCursor.continuePrimaryKey() method functionality

function upgradeFunc(db: IDBDatabase) {
    const store = db.createObjectStore("store")
    store.createIndex("index", "indexKey", {
        multiEntry: true,
    })

    store.put({ indexKey: ["a", "b"] }, 1)
    store.put({ indexKey: ["a", "b"] }, 2)
    store.put({ indexKey: ["a", "b"] }, 3)
    store.put({ indexKey: ["b"] }, 4)
}

describe("IDBCursor.continuePrimaryKey()", () => {
    test("Multi-entry index entries are created as expected", async ({
        task,
    }) => {
        const db = await createDatabase(task, upgradeFunc)

        const expectedIndexEntries = [
            { key: "a", primaryKey: 1 },
            { key: "a", primaryKey: 2 },
            { key: "a", primaryKey: 3 },
            { key: "b", primaryKey: 1 },
            { key: "b", primaryKey: 2 },
            { key: "b", primaryKey: 3 },
            { key: "b", primaryKey: 4 },
        ]

        const tx = db.transaction("store", "readonly")
        const index = tx.objectStore("store").index("index")
        const request = index.openCursor()

        let currentEntry = 0
        let cursor: IDBCursorWithValue | null = await requestToPromise(request)

        while (cursor && currentEntry < expectedIndexEntries.length) {
            const expectedEntry = expectedIndexEntries[currentEntry]
            expect(cursor.key).toBe(expectedEntry.key)
            expect(cursor.primaryKey).toBe(expectedEntry.primaryKey)

            currentEntry++
            cursor.continue()
            cursor = await requestToPromise(request)
        }

        expect(cursor).toBeNull()
        expect(currentEntry).toBe(expectedIndexEntries.length)
    })

    test("continue() moves to next entry", async ({ task }) => {
        const db = await createDatabase(task, upgradeFunc)

        const tx = db.transaction("store", "readonly")
        const index = tx.objectStore("store").index("index")
        const request = index.openCursor()

        const cursor = await requestToPromise(request)
        expect(cursor).not.toBeNull()
        expect(cursor?.key).toBe("a")
        expect(cursor?.primaryKey).toBe(1)

        cursor?.continue()
        const cursor2 = await requestToPromise(request)
        expect(cursor2?.key).toBe("a")
        expect(cursor2?.primaryKey).toBe(2)
    })

    test("continue(key) with same key throws DataError", async ({ task }) => {
        const db = await createDatabase(task, upgradeFunc)

        const tx = db.transaction("store", "readonly")
        const index = tx.objectStore("store").index("index")
        const request = index.openCursor()

        const cursor = await requestToPromise(request)
        expect(cursor).not.toBeNull()

        expect(() => {
            cursor?.continue("a")
        }).toThrow("Data provided to an operation does not meet requirements.")
    })

    test("continue(key) with larger key", async ({ task }) => {
        const db = await createDatabase(task, upgradeFunc)

        const tx = db.transaction("store", "readonly")
        const index = tx.objectStore("store").index("index")
        const request = index.openCursor()

        const cursor = await requestToPromise(request)
        expect(cursor).not.toBeNull()

        cursor?.continue("b")
        const cursor2 = await requestToPromise(request)
        expect(cursor2?.key).toBe("b")
        expect(cursor2?.primaryKey).toBe(1)
    })

    test("continue(key) with key beyond range", async ({ task }) => {
        const db = await createDatabase(task, upgradeFunc)

        const tx = db.transaction("store", "readonly")
        const index = tx.objectStore("store").index("index")
        const request = index.openCursor()

        const cursor = await requestToPromise(request)
        expect(cursor).not.toBeNull()

        cursor?.continue("c")
        const cursor2 = await requestToPromise(request)
        expect(cursor2).toBeNull()
    })

    test("continuePrimaryKey(key, primaryKey) advances to specified position", async ({
        task,
    }) => {
        const db = await createDatabase(task, upgradeFunc)

        const tx = db.transaction("store", "readonly")
        const index = tx.objectStore("store").index("index")
        const request = index.openCursor()

        const cursor = await requestToPromise(request)
        expect(cursor).not.toBeNull()

        cursor?.continuePrimaryKey("a", 3)
        const cursor2 = await requestToPromise(request)
        expect(cursor2?.key).toBe("a")
        expect(cursor2?.primaryKey).toBe(3)
    })

    test("continuePrimaryKey(key, primaryKey) advances to next key when primaryKey beyond range", async ({
        task,
    }) => {
        const db = await createDatabase(task, upgradeFunc)

        const tx = db.transaction("store", "readonly")
        const index = tx.objectStore("store").index("index")
        const request = index.openCursor()

        const cursor = await requestToPromise(request)
        expect(cursor).not.toBeNull()

        cursor?.continuePrimaryKey("a", 4)
        const cursor2 = await requestToPromise(request)
        expect(cursor2?.key).toBe("b")
        expect(cursor2?.primaryKey).toBe(1)
    })

    test("continuePrimaryKey(key, primaryKey) works with exact matches", async ({
        task,
    }) => {
        const db = await createDatabase(task, upgradeFunc)

        const tx = db.transaction("store", "readonly")
        const index = tx.objectStore("store").index("index")
        const request = index.openCursor()

        const cursor = await requestToPromise(request)
        expect(cursor).not.toBeNull()

        cursor?.continuePrimaryKey("b", 1)
        const cursor2 = await requestToPromise(request)
        expect(cursor2?.key).toBe("b")
        expect(cursor2?.primaryKey).toBe(1)
    })

    test("continuePrimaryKey(key, primaryKey) advances to exact position in same key", async ({
        task,
    }) => {
        const db = await createDatabase(task, upgradeFunc)

        const tx = db.transaction("store", "readonly")
        const index = tx.objectStore("store").index("index")
        const request = index.openCursor()

        const cursor = await requestToPromise(request)
        expect(cursor).not.toBeNull()

        cursor?.continuePrimaryKey("b", 4)
        const cursor2 = await requestToPromise(request)
        expect(cursor2?.key).toBe("b")
        expect(cursor2?.primaryKey).toBe(4)
    })

    test("continuePrimaryKey(key, primaryKey) returns null when beyond range", async ({
        task,
    }) => {
        const db = await createDatabase(task, upgradeFunc)

        const tx = db.transaction("store", "readonly")
        const index = tx.objectStore("store").index("index")
        const request = index.openCursor()

        const cursor = await requestToPromise(request)
        expect(cursor).not.toBeNull()

        cursor?.continuePrimaryKey("b", 5)
        const cursor2 = await requestToPromise(request)
        expect(cursor2).toBeNull()
    })

    test("continuePrimaryKey(key, primaryKey) returns null when key beyond range", async ({
        task,
    }) => {
        const db = await createDatabase(task, upgradeFunc)

        const tx = db.transaction("store", "readonly")
        const index = tx.objectStore("store").index("index")
        const request = index.openCursor()

        const cursor = await requestToPromise(request)
        expect(cursor).not.toBeNull()

        cursor?.continuePrimaryKey("c", 1)
        const cursor2 = await requestToPromise(request)
        expect(cursor2).toBeNull()
    })

    test("continuePrimaryKey(null, primaryKey) throws DataError", async ({
        task,
    }) => {
        const db = await createDatabase(task, upgradeFunc)

        const tx = db.transaction("store", "readonly")
        const index = tx.objectStore("store").index("index")
        const request = index.openCursor()

        const cursor = await requestToPromise(request)
        expect(cursor).not.toBeNull()

        expect(() => {
            cursor?.continuePrimaryKey(null as unknown as IDBValidKey, 1)
        }).toThrow("Data provided to an operation does not meet requirements.")
    })

    test("continuePrimaryKey(key, null) throws DataError", async ({ task }) => {
        const db = await createDatabase(task, upgradeFunc)

        const tx = db.transaction("store", "readonly")
        const index = tx.objectStore("store").index("index")
        const request = index.openCursor()

        const cursor = await requestToPromise(request)
        expect(cursor).not.toBeNull()

        expect(() => {
            cursor?.continuePrimaryKey("a", null as unknown as IDBValidKey)
        }).toThrow("Data provided to an operation does not meet requirements.")
    })
})
