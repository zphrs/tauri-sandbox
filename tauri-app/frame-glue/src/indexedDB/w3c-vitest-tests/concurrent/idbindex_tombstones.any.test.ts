import { describe, expect, test } from "vitest"
import { createDatabase } from "../resources/createDatabase"
import { FDBKeyRange as IDBKeyRange } from "../../inMemoryIdb"

// Port of w3c test: idbindex_tombstones.any.js
// This test is used to trigger a special case in Chrome with how it deals with
// index creation & modification. This had caused issues before.
// See https://crbug.com/1033996

async function iterateAndReturnAllCursorResult(
    cursorRequest: IDBRequest<IDBCursorWithValue | null>,
): Promise<unknown[]> {
    return new Promise((resolve, reject) => {
        const results: unknown[] = []
        cursorRequest.onsuccess = function (event) {
            const cursor = (
                event.target as IDBRequest<IDBCursorWithValue | null>
            ).result
            if (!cursor) {
                resolve(results)
                return
            }
            results.push(cursor.value)
            cursor.continue()
        }
        cursorRequest.onerror = reject
    })
}

function promiseForTransaction(transaction: IDBTransaction): Promise<void> {
    return new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve()
        transaction.onerror = () => reject(transaction.error)
        transaction.onabort = () => reject(new Error("Transaction aborted"))
    })
}

async function createTombstones(db: IDBDatabase): Promise<void> {
    const txn1 = db.transaction(["objectStore"], "readwrite")
    txn1.objectStore("objectStore").add({ key: "firstItem", indexedOn: 1 })
    txn1.objectStore("objectStore").add({ key: "secondItem", indexedOn: 2 })
    txn1.objectStore("objectStore").add({ key: "thirdItem", indexedOn: 3 })

    const txn2 = db.transaction(["objectStore"], "readwrite")
    txn2.objectStore("objectStore").put({ key: "firstItem", indexedOn: -10 })
    txn2.objectStore("objectStore").put({ key: "secondItem", indexedOn: 4 })
    txn2.objectStore("objectStore").put({ key: "thirdItem", indexedOn: 10 })

    await promiseForTransaction(txn1)
    await promiseForTransaction(txn2)
}

async function runTest(
    task: { id?: string },
    transactionMode: IDBTransactionMode,
    direction: IDBCursorDirection,
): Promise<void> {
    const db = await createDatabase(task, (db) => {
        db.createObjectStore("objectStore", { keyPath: "key" }).createIndex(
            "index",
            "indexedOn",
        )
    })

    await createTombstones(db)

    const txn = db.transaction(["objectStore"], transactionMode)
    const cursor = txn
        .objectStore("objectStore")
        .index("index")
        .openCursor(IDBKeyRange.bound(-11, 11), direction)

    const results = await iterateAndReturnAllCursorResult(cursor)
    expect(results.length).toBe(3)

    // Verify count().
    await new Promise<void>((resolve, reject) => {
        const countRequest = txn
            .objectStore("objectStore")
            .index("index")
            .count()
        countRequest.onsuccess = (event) => {
            expect((event.target as IDBRequest<number>).result).toBe(3)
            resolve()
        }
        countRequest.onerror = reject
    })

    db.close()
}

describe("Index Tombstones", () => {
    test("Forward iteration over an index in a readonly transaction", async ({
        task,
    }) => {
        await runTest(task, "readonly", "next")
    })

    test("Backward iteration over an index in a readonly transaction", async ({
        task,
    }) => {
        await runTest(task, "readonly", "prev")
    })

    test("Forward iteration over an index in a readwrite transaction", async ({
        task,
    }) => {
        await runTest(task, "readwrite", "next")
    })

    test("Backward iteration over an index in a readwrite transaction", async ({
        task,
    }) => {
        await runTest(task, "readwrite", "prev")
    })
})
