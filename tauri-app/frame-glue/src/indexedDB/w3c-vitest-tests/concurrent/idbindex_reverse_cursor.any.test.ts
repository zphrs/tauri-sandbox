import { describe, expect, test } from "vitest"
import { createDatabase } from "../resources/createDatabase"
import { FDBKeyRange as IDBKeyRange } from "../../inMemoryIdb"

// Port of w3c test: idbindex_reverse_cursor.any.js
// Tests reverse cursor validity

async function iterateAndReturnAllCursorResult(
    cursor: IDBRequest<IDBCursorWithValue | null>,
): Promise<unknown[]> {
    return new Promise((resolve, reject) => {
        const results: unknown[] = []
        cursor.onsuccess = function (e) {
            const cursor = (e.target as IDBRequest<IDBCursorWithValue | null>)
                .result
            if (!cursor) {
                resolve(results)
                return
            }
            results.push(cursor.value)
            cursor.continue()
        }
        cursor.onerror = reject
    })
}

function promiseForTransaction(transaction: IDBTransaction): Promise<void> {
    return new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve()
        transaction.onerror = () => reject(transaction.error)
        transaction.onabort = () => reject(new Error("Transaction aborted"))
    })
}

describe("IDBIndex reverse cursor", () => {
    test("Reverse cursor sees update from separate transactions", async ({
        task,
    }) => {
        const db = await createDatabase(task, (db) => {
            db.createObjectStore("objectStore", { keyPath: "key" }).createIndex(
                "index",
                "indexedOn",
            )
        })

        const txn1 = db.transaction(["objectStore"], "readwrite")
        txn1.objectStore("objectStore").add({
            key: "firstItem",
            indexedOn: 3,
        })

        const txn2 = db.transaction(["objectStore"], "readwrite")
        txn2.objectStore("objectStore").put({
            key: "firstItem",
            indexedOn: -1,
        })

        const txn3 = db.transaction(["objectStore"], "readwrite")
        txn3.objectStore("objectStore").add({
            key: "secondItem",
            indexedOn: 2,
        })

        const txn4 = db.transaction(["objectStore"], "readonly")
        const txnWaiter = promiseForTransaction(txn4)
        const cursor = txn4
            .objectStore("objectStore")
            .index("index")
            .openCursor(IDBKeyRange.bound(0, 10), "prev")
        const results = await iterateAndReturnAllCursorResult(cursor)

        expect(results.length).toBe(1)

        await txnWaiter
        db.close()
    })

    test("Reverse cursor sees in-transaction update", async ({ task }) => {
        const db = await createDatabase(task, (db) => {
            db.createObjectStore("objectStore", { keyPath: "key" }).createIndex(
                "index",
                "indexedOn",
            )
        })

        const txn = db.transaction(["objectStore"], "readwrite")
        txn.objectStore("objectStore").add({ key: "1", indexedOn: 2 })
        txn.objectStore("objectStore").put({ key: "1", indexedOn: -1 })
        txn.objectStore("objectStore").add({ key: "2", indexedOn: 1 })

        const txn2 = db.transaction(["objectStore"], "readonly")
        const txnWaiter = promiseForTransaction(txn2)
        const cursor = txn2
            .objectStore("objectStore")
            .index("index")
            .openCursor(IDBKeyRange.bound(0, 10), "prev")
        const results = await iterateAndReturnAllCursorResult(cursor)
        expect(results.length).toBe(1)
        await txnWaiter
        db.close()
    })
})
