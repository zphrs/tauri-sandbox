import { test, expect } from "vitest"
import { createDatabase, requestToPromise } from "../resources/createDatabase"

import { FDBKeyRange as IDBKeyRange } from "../../inMemoryIdb"

// Port of w3c test: cursor-overloads.any.js
// Verifies that IDBCursor methods handle overloads correctly.

test("Validate the overloads of IDBObjectStore.openCursor(), IDBIndex.openCursor() and IDBIndex.openKeyCursor()", async ({
    task,
}) => {
    const db = await createDatabase(task, (db) => {
        const store = db.createObjectStore("store")
        store.createIndex("index", "value")
        store.put({ value: 0 }, 0)
    })

    const trans = db.transaction("store", "readwrite")
    const store = trans.objectStore("store")
    // to make sure that it works even if there's a new record within the transaction
    // not in the original test
    store.add({ value: 1 }, 1)
    const index = store.index("index")

    async function checkCursorDirection(
        request:
            | IDBRequest<IDBCursor | null>
            | IDBRequest<IDBCursorWithValue | null>,
        direction: IDBCursorDirection,
    ) {
        const cursor = await requestToPromise<IDBCursor | null>(
            request as IDBRequest<IDBCursor | null>,
        )
        expect(cursor).not.toBeNull()
        expect(cursor!.direction).toBe(direction)
    }

    await Promise.all([
        checkCursorDirection(store.openCursor(), "next"),
        checkCursorDirection(store.openCursor(0), "next"),
        checkCursorDirection(store.openCursor(0, "next"), "next"),
        checkCursorDirection(store.openCursor(0, "nextunique"), "nextunique"),
        checkCursorDirection(store.openCursor(0, "prev"), "prev"),
        checkCursorDirection(store.openCursor(0, "prevunique"), "prevunique"),

        checkCursorDirection(store.openCursor(IDBKeyRange.only(0)), "next"),

        checkCursorDirection(
            store.openCursor(IDBKeyRange.only(0), "next"),
            "next",
        ),
        checkCursorDirection(
            store.openCursor(IDBKeyRange.only(0), "nextunique"),
            "nextunique",
        ),
        checkCursorDirection(
            store.openCursor(IDBKeyRange.only(0), "prev"),
            "prev",
        ),
        checkCursorDirection(
            store.openCursor(IDBKeyRange.only(0), "prevunique"),
            "prevunique",
        ),

        checkCursorDirection(index.openCursor(), "next"),
        checkCursorDirection(index.openCursor(0), "next"),
        checkCursorDirection(index.openCursor(0, "next"), "next"),
        checkCursorDirection(index.openCursor(0, "nextunique"), "nextunique"),
        checkCursorDirection(index.openCursor(0, "prev"), "prev"),
        checkCursorDirection(index.openCursor(0, "prevunique"), "prevunique"),

        checkCursorDirection(index.openCursor(IDBKeyRange.only(0)), "next"),
        checkCursorDirection(
            index.openCursor(IDBKeyRange.only(0), "next"),
            "next",
        ),
        checkCursorDirection(
            index.openCursor(IDBKeyRange.only(0), "nextunique"),
            "nextunique",
        ),
        checkCursorDirection(
            index.openCursor(IDBKeyRange.only(0), "prev"),
            "prev",
        ),
        checkCursorDirection(
            index.openCursor(IDBKeyRange.only(0), "prevunique"),
            "prevunique",
        ),

        checkCursorDirection(index.openKeyCursor(), "next"),
        checkCursorDirection(index.openKeyCursor(0), "next"),
        checkCursorDirection(index.openKeyCursor(0, "next"), "next"),
        checkCursorDirection(
            index.openKeyCursor(0, "nextunique"),
            "nextunique",
        ),
        checkCursorDirection(index.openKeyCursor(0, "prev"), "prev"),
        checkCursorDirection(
            index.openKeyCursor(0, "prevunique"),
            "prevunique",
        ),

        checkCursorDirection(index.openKeyCursor(IDBKeyRange.only(0)), "next"),
        checkCursorDirection(
            index.openKeyCursor(IDBKeyRange.only(0), "next"),
            "next",
        ),
        checkCursorDirection(
            index.openKeyCursor(IDBKeyRange.only(0), "nextunique"),
            "nextunique",
        ),
        checkCursorDirection(
            index.openKeyCursor(IDBKeyRange.only(0), "prev"),
            "prev",
        ),
        checkCursorDirection(
            index.openKeyCursor(IDBKeyRange.only(0), "prevunique"),
            "prevunique",
        ),
    ])
})
