import { describe, expect, test } from "vitest"
import {
    createDatabase,
    requestToPromise,
    idb,
} from "../resources/createDatabase"
import { InvalidStateError, ReadOnlyError } from "../../inMemoryIdb/lib/errors"

// Port of w3c test: idbcursor_delete_objectstore.any.js
// Tests IDBCursor.delete() method functionality on object store

function createObjectStoreAndPopulate(
    db: IDBDatabase,
    records: Array<{ pKey: string; iKey?: string }>,
) {
    const objStore = db.createObjectStore("test", { keyPath: "pKey" })

    for (const record of records) {
        objStore.add(record)
    }
    return objStore
}

describe("IDBCursor.delete() - object store", () => {
    test("Remove a record from the object store", async ({ task }) => {
        const records = [{ pKey: "primaryKey_0" }, { pKey: "primaryKey_1" }]
        let count = 0

        const db = await createDatabase(task, (db) => {
            createObjectStoreAndPopulate(db, records)
        })

        // Delete record using cursor - just like the original test
        const txn = db.transaction("test", "readwrite")
        const cursor_rq = txn.objectStore("test").openCursor()

        const cursor = await requestToPromise(cursor_rq)
        expect(cursor).not.toBeNull()
        expect(cursor).toBeTruthy()

        // Record which key the cursor is on and which will remain
        const firstCursorKey = cursor!.value.pKey
        const expectedRemainingKey = records.find(
            (r) => r.pKey !== firstCursorKey,
        )!.pKey

        // Delete the current record and wait for completion
        await requestToPromise(cursor!.delete())

        // Wait for transaction to complete
        await new Promise<void>((resolve) => {
            txn.oncomplete = () => resolve()
        })

        // Verify exactly 1 record remains and it's the one we didn't delete
        const readTxn = db.transaction("test", "readonly")
        const verifyCursor_rq = readTxn.objectStore("test").openCursor()

        let verifyCursor = await requestToPromise(verifyCursor_rq)
        while (verifyCursor) {
            expect(verifyCursor.value.pKey).toBe(expectedRemainingKey)
            count++
            verifyCursor.continue()
            verifyCursor = await requestToPromise(verifyCursor_rq)
        }

        expect(count).toBe(1)
    })

    test("Attempt to remove a record in a read-only transaction", async ({
        task,
    }) => {
        const records = [
            { pKey: "primaryKey_0", iKey: "indexKey_0" },
            { pKey: "primaryKey_1", iKey: "indexKey_1" },
        ]

        const db = await createDatabase(task, (db) => {
            createObjectStoreAndPopulate(db, records)
        })

        const cursor_rq = db
            .transaction("test", "readonly")
            .objectStore("test")
            .openCursor()

        const cursor = await requestToPromise(cursor_rq)
        expect(cursor).not.toBeNull()
        expect(cursor).toBeTruthy()

        expect(() => {
            cursor!.delete()
        }).toThrow(ReadOnlyError)
    })

    test("Attempt to remove a record in an inactive transaction", async () => {
        const records = [
            { pKey: "primaryKey_0", iKey: "indexKey_0" },
            { pKey: "primaryKey_1", iKey: "indexKey_1" },
        ]
        let savedCursor: IDBCursorWithValue

        await new Promise<void>((resolve) => {
            const dbname = `test-${Date.now()}-${Math.random()}`
            const openReq = idb.open(dbname)
            openReq.onupgradeneeded = () => {
                const db = openReq.result
                const objStore = createObjectStoreAndPopulate(db, records)
                const cursor_rq = objStore.openCursor()
                cursor_rq.onsuccess = (e) => {
                    const cursor = (e.target as IDBRequest).result
                    expect(cursor).toBeInstanceOf(Object) // cursor exists
                    savedCursor = cursor
                }

                openReq.transaction!.oncomplete = () => {
                    // Transaction is now inactive
                    expect(() => {
                        savedCursor.delete()
                    }).toThrow(
                        /TransactionInactiveError|A request was placed against a transaction.*not active/i,
                    )
                    resolve()
                }
            }
        })
    })

    test("Throw InvalidStateError when the cursor's source object store has been deleted", async () => {
        const records = [{ pKey: "primaryKey_0" }, { pKey: "primaryKey_1" }]

        await new Promise<void>((resolve) => {
            const dbname = `test-${Date.now()}-${Math.random()}`
            const openReq = idb.open(dbname)
            openReq.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result
                const objStore = createObjectStoreAndPopulate(db, records)
                const rq = objStore.openCursor()
                rq.onsuccess = (event) => {
                    const cursor = (event.target as IDBRequest).result
                    expect(cursor).toBeInstanceOf(Object) // cursor exists

                    db.deleteObjectStore("test")
                    expect(() => {
                        cursor.delete()
                    }).toThrow(InvalidStateError)

                    resolve()
                }
            }
        })
    })

    test("Throw InvalidStateError when the cursor is being iterated", async ({
        task,
    }) => {
        const records = [{ pKey: "primaryKey_0" }, { pKey: "primaryKey_1" }]

        const db = await createDatabase(task, (db) => {
            createObjectStoreAndPopulate(db, records)
        })

        const txn = db.transaction("test", "readwrite")
        const rq = txn.objectStore("test").openCursor()

        const cursor = await requestToPromise(rq)
        expect(cursor).not.toBeNull()
        expect(cursor).toBeTruthy()

        cursor!.continue()
        expect(() => {
            cursor!.delete()
        }).toThrow(InvalidStateError)
    })
})
