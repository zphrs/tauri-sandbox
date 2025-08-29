import { describe, expect, test } from "vitest"
import { createDatabase, requestToPromise } from "../resources/createDatabase"
import {
    DataError,
    InvalidStateError,
    ReadOnlyError,
} from "../../inMemoryIdb/lib/errors"

// Port of w3c test: idbcursor_update_objectstore.any.js
// Tests IDBCursor.update() method on object stores

interface Record {
    pKey: string
    iKey?: string
    data?: unknown
    value?: unknown
}

function createObjectStoreAndPopulate(
    db: IDBDatabase,
    records: Record[],
): IDBObjectStore {
    const objStore = db.createObjectStore("test", { keyPath: "pKey" })
    for (let i = 0; i < records.length; i++) {
        objStore.add(records[i])
    }
    return objStore
}

describe("IDBCursor.update() - object store", () => {
    test("Modify a record in the object store", async ({ task }) => {
        const records: Record[] = [
            { pKey: "primaryKey_0" },
            { pKey: "primaryKey_1" },
        ]

        const db = await createDatabase(task, (database) => {
            createObjectStoreAndPopulate(database, records)
        })

        // First phase: update the record
        const writeTxn = db.transaction("test", "readwrite")
        const writeStore = writeTxn.objectStore("test")
        const writeCursorRequest = writeStore.openCursor()

        const writeCursor = await requestToPromise(writeCursorRequest)
        expect(writeCursor).toBeTruthy()

        const updatedValue = { ...writeCursor!.value }
        updatedValue.data = "New information!"
        writeCursor!.update(updatedValue)

        // Wait for transaction to complete
        await new Promise<void>((resolve) => {
            writeTxn.oncomplete = () => resolve()
        })

        // Second phase: verify record was updated
        const readTxn = db.transaction("test", "readonly")
        const readStore = readTxn.objectStore("test")
        const readCursorRequest = readStore.openCursor()

        const readCursor = await requestToPromise(readCursorRequest)
        expect(readCursor).toBeTruthy()
        expect(readCursor!.value.data).toBe("New information!")
    })

    test("Attempt to modify a record in a read-only transaction", async ({
        task,
    }) => {
        const records: Record[] = [
            { pKey: "primaryKey_0", iKey: "indexKey_0" },
            { pKey: "primaryKey_1", iKey: "indexKey_1" },
        ]

        const db = await createDatabase(task, (database) => {
            createObjectStoreAndPopulate(database, records)
        })

        const tx = db.transaction("test", "readonly")
        const store = tx.objectStore("test")
        const cursorRequest = store.openCursor()

        const cursor = await requestToPromise(cursorRequest)
        expect(cursor).toBeTruthy()

        expect(() => {
            cursor!.update(cursor!.value)
        }).toThrow(ReadOnlyError)
    })

    test("Object store - attempt to modify a record in an inactive transaction", async ({
        task,
    }) => {
        const records: Record[] = [
            { pKey: "primaryKey_0", iKey: "indexKey_0" },
            { pKey: "primaryKey_1", iKey: "indexKey_1" },
        ]

        let cursor: IDBCursorWithValue | null = null
        let record: Record | null = null

        await createDatabase(task, (database) => {
            const objStore = createObjectStoreAndPopulate(database, records)
            const cursorRequest = objStore.openCursor()

            cursorRequest.onsuccess = () => {
                cursor = cursorRequest.result
                if (cursor) {
                    record = cursor.value
                }
            }
        })

        // Wait for the upgrade transaction to complete, making it inactive
        await new Promise((resolve) => setTimeout(resolve, 0))

        expect(cursor).toBeTruthy()
        expect(record).toBeTruthy()

        expect(() => {
            cursor!.update(record!)
        }).toThrow(
            /TransactionInactiveError|A request was placed against a transaction.*not active/i,
        )
    })

    test("Index - modify a record in the object store", async ({ task }) => {
        const db = await createDatabase(task, (database) => {
            const objStore = database.createObjectStore("test")
            objStore.add("data", "key")
        })

        const txn = db.transaction("test", "readwrite")
        const store = txn.objectStore("test")
        const cursorRequest = store.openCursor()

        const cursor = await requestToPromise(cursorRequest)
        expect(cursor).toBeTruthy()

        const updatedValue: Record = { ...cursor!.value }
        updatedValue.pKey = "new data!"
        const updateRequest = cursor!.update(updatedValue)

        const result = await requestToPromise(updateRequest)
        expect(result).toBe("key")
    })

    test("Attempt to modify a record after the cursor's source or effective object store has been deleted", async ({
        task,
    }) => {
        const records: Record[] = [
            { pKey: "primaryKey_0" },
            { pKey: "primaryKey_1" },
        ]

        let cursor: IDBCursorWithValue | null = null

        await createDatabase(task, (database) => {
            const objStore = createObjectStoreAndPopulate(database, records)
            const cursorRequest = objStore.openCursor()

            cursorRequest.onsuccess = () => {
                cursor = cursorRequest.result
                if (cursor) {
                    database.deleteObjectStore("test")
                    const updatedValue = { ...cursor.value }
                    updatedValue.pKey += "_updated"

                    expect(() => {
                        cursor!.update(updatedValue)
                    }).toThrow(InvalidStateError)
                }
            }
        })

        expect(cursor).toBeTruthy()
    })

    test("Throw DataCloneError", async ({ task }) => {
        const records: Record[] = [
            { pKey: "primaryKey_0", iKey: "indexKey_0" },
            { pKey: "primaryKey_1", iKey: "indexKey_1" },
        ]

        const db = await createDatabase(task, (database) => {
            createObjectStoreAndPopulate(database, records)
        })

        const tx = db.transaction("test", "readwrite")
        const store = tx.objectStore("test")
        const cursorRequest = store.openCursor()

        const cursor = await requestToPromise(cursorRequest)
        expect(cursor).toBeTruthy()

        const record: Record = { ...cursor!.value }
        // Add a property that can't be cloned (like self/window in browser)
        record.data = () => {}

        expect(() => {
            cursor!.update(record)
        }).toThrow(DataError)
    })

    test("No argument", async ({ task }) => {
        const records: Record[] = [
            { pKey: "primaryKey_0", iKey: "indexKey_0" },
            { pKey: "primaryKey_1", iKey: "indexKey_1" },
        ]

        const db = await createDatabase(task, (database) => {
            createObjectStoreAndPopulate(database, records)
        })

        const tx = db.transaction("test", "readwrite")
        const store = tx.objectStore("test")
        const cursorRequest = store.openCursor()

        const cursor = await requestToPromise(cursorRequest)
        expect(cursor).toBeTruthy()

        expect(() => {
            ;(cursor!.update as (value?: unknown) => IDBRequest)()
        }).toThrow()
    })

    test("Throw DataError", async ({ task }) => {
        const records: Record[] = [
            { pKey: "primaryKey_0", iKey: "indexKey_0" },
            { pKey: "primaryKey_1", iKey: "indexKey_1" },
        ]

        const db = await createDatabase(task, (database) => {
            createObjectStoreAndPopulate(database, records)
        })

        const tx = db.transaction("test", "readwrite")
        const store = tx.objectStore("test")
        const cursorRequest = store.openCursor()

        const cursor = await requestToPromise(cursorRequest)
        expect(cursor).toBeTruthy()

        expect(() => {
            cursor!.update(null as unknown)
        }).toThrow(
            /DataError|Data provided to an operation does not meet requirements/i,
        )
    })

    test("Throw InvalidStateError when the cursor is being iterated", async ({
        task,
    }) => {
        const records: Record[] = [
            { pKey: "primaryKey_0", value: "value_0" },
            { pKey: "primaryKey_1", value: "value_1" },
        ]

        const db = await createDatabase(task, (database) => {
            createObjectStoreAndPopulate(database, records)
        })

        const tx = db.transaction("test", "readwrite")
        const store = tx.objectStore("test")
        const cursorRequest = store.openCursor()

        const cursor = await requestToPromise(cursorRequest)
        expect(cursor).toBeTruthy()

        cursor!.continue()

        expect(() => {
            cursor!.update({
                pKey: "primaryKey_0",
                value: "value_0_updated",
            })
        }).toThrow(InvalidStateError)
    })
})
