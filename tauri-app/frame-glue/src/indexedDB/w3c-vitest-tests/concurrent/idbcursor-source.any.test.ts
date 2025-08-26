import { describe, expect, test } from "vitest"
import { createDatabase, requestToPromise } from "../resources/createDatabase"

// Port of w3c test: idbcursor-source.any.js
// Verifies that IDBRequest.source is set to the originating objectStore or index

function populate(db: IDBDatabase) {
    const store = db.createObjectStore("store", { autoIncrement: true })
    store.createIndex("index", "value")

    store.put({ value: "a" })
    store.put({ value: "b" })
}

describe("IDBCursor request.source", () => {
    test("objectStore openCursor request.source is objectStore", async ({
        task,
    }) => {
        const db = await createDatabase(task, populate)

        const tx = db.transaction("store", "readonly")
        const store = tx.objectStore("store")
        const req = store.openCursor()

        await requestToPromise(req)
        // The request that produced the cursor should have source === objectStore
        expect((req as unknown as IDBRequest).source).toBe(store)
    })

    test("index openCursor request.source is index", async ({ task }) => {
        const db = await createDatabase(task, populate)

        const tx = db.transaction("store", "readonly")
        const store = tx.objectStore("store")
        const idx = store.index("index")
        const req = idx.openCursor()

        await requestToPromise(req)
        expect((req as unknown as IDBRequest).source).toBe(idx)
    })

    test("objectStore openKeyCursor request.source is objectStore", async ({
        task,
    }) => {
        const db = await createDatabase(task, populate)

        const tx = db.transaction("store", "readonly")
        const store = tx.objectStore("store")
        const req = store.openKeyCursor()

        await requestToPromise(req)
        // openKeyCursor yields cursors without value; ensure request resolved and source match
        expect((req as unknown as IDBRequest).source).toBe(store)
    })

    test("index openKeyCursor request.source is index", async ({ task }) => {
        const db = await createDatabase(task, populate)

        const tx = db.transaction("store", "readonly")
        const store = tx.objectStore("store")
        const idx = store.index("index")
        const req = idx.openKeyCursor()

        await requestToPromise(req)
        expect((req as unknown as IDBRequest).source).toBe(idx)
    })
})
