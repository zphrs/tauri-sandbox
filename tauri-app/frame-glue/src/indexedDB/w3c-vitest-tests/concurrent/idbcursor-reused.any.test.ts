import { describe, expect, test } from "vitest"
import { createDatabase, requestToPromise } from "../resources/createDatabase"

// Port of w3c test: idbcursor-reused.any.js
// Verifies that the same IDBCursor object is reused for successive success events

function populateStore(db: IDBDatabase) {
    const store = db.createObjectStore("store", { autoIncrement: true })
    store.createIndex("index", "value")
    store.put({ value: "a" })
    store.put({ value: "b" })
    store.put({ value: "c" })
    store.put({ value: "d" })
}

describe("IDBCursor reuse", () => {
    test("cursor object is reused for object store iteration", async ({
        task,
    }) => {
        const db = await createDatabase(task, populateStore)

        const tx = db.transaction("store", "readonly")
        const store = tx.objectStore("store")
        const req = store.openCursor()

        const first = (await requestToPromise(req)) as IDBCursorWithValue | null
        expect(first).not.toBeNull()

        // Advance and get the next cursor for the same request
        first!.continue()
        const second = (await requestToPromise(
            req,
        )) as IDBCursorWithValue | null
        expect(second).not.toBeNull()
        // The cursor object should be the same instance
        expect(second).toBe(first)

        // Continue once more
        second!.continue()
        const third = (await requestToPromise(req)) as IDBCursorWithValue | null
        expect(third).not.toBeNull()
        expect(third).toBe(first)

        // Skip to the end and ensure the request resolves to null
        third!.advance(100)
        const finalCursor = await requestToPromise(req)
        expect(finalCursor).toBeNull()
    })

    test("cursor object is reused for index iteration", async ({ task }) => {
        const db = await createDatabase(task, populateStore)

        const tx = db.transaction("store", "readonly")
        const idx = tx.objectStore("store").index("index")
        const req = idx.openCursor()

        const first = (await requestToPromise(req)) as IDBCursorWithValue | null
        expect(first).not.toBeNull()

        first!.continue()
        const second = (await requestToPromise(
            req,
        )) as IDBCursorWithValue | null
        expect(second).not.toBeNull()
        expect(second).toBe(first)

        second!.continue()
        const third = (await requestToPromise(req)) as IDBCursorWithValue | null
        expect(third).not.toBeNull()
        expect(third).toBe(first)
    })
})
