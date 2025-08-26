import { describe, expect, test } from "vitest"
import { createDatabase, requestToPromise } from "../resources/createDatabase"
import { FDBKeyRange as IDBKeyRange } from "../../inMemoryIdb"
import {
    DataCloneError,
    InvalidStateError,
    ReadOnlyError,
} from "../../inMemoryIdb/lib/errors"

// Port of w3c test: idbcursor_update_index.any.js
// Tests IDBCursor.update() method on indexes

interface Record {
    pKey: string
    iKey: string
}

interface RecordWithNumber {
    pKey: string
    iKey: number
}

function createObjectStoreWithIndexAndPopulate(
    db: IDBDatabase,
    records: Record[],
) {
    const objStore = db.createObjectStore("test", { keyPath: "pKey" })
    objStore.createIndex("index", "iKey")
    for (let i = 0; i < records.length; i++) {
        objStore.add(records[i])
    }
    return objStore
}

describe("IDBCursor.update() - index", () => {
    test("Modify a record in the object store", async ({ task }) => {
        const records: Record[] = [
            { pKey: "primaryKey_0", iKey: "indexKey_0" },
            { pKey: "primaryKey_1", iKey: "indexKey_1" },
        ]

        const db = await createDatabase(task, (database) => {
            createObjectStoreWithIndexAndPopulate(database, records)
        })

        // First phase: update the record
        const writeTxn = db.transaction("test", "readwrite")
        const writeStore = writeTxn.objectStore("test")
        const writeIndex = writeStore.index("index")
        const writeCursorRequest = writeIndex.openCursor()

        const writeCursor = await requestToPromise(writeCursorRequest)
        expect(writeCursor).toBeTruthy()
        expect(writeCursor).toBeInstanceOf(Object) // IDBCursor

        const updatedValue = { ...writeCursor!.value }
        updatedValue.iKey += "_updated"

        // Don't await the update request, just call it
        writeCursor!.update(updatedValue)

        // Wait for transaction to complete
        await new Promise<void>((resolve) => {
            writeTxn.oncomplete = () => resolve()
        })

        // Second phase: verify record was updated by reading from object store
        const readTxn = db.transaction("test", "readonly")
        const readStore = readTxn.objectStore("test")
        const readCursorRequest = readStore.openCursor()

        const readCursor = await requestToPromise(readCursorRequest)
        expect(readCursor).toBeTruthy()
        expect(readCursor!.value.iKey).toBe(records[0].iKey + "_updated")
    })

    test("Attempt to modify a record in a read-only transaction", async ({
        task,
    }) => {
        const records: Record[] = [
            { pKey: "primaryKey_0", iKey: "indexKey_0" },
            { pKey: "primaryKey_1", iKey: "indexKey_1" },
        ]

        const db = await createDatabase(task, (database) => {
            createObjectStoreWithIndexAndPopulate(database, records)
        })

        const tx = db.transaction("test", "readonly")
        const store = tx.objectStore("test")
        const index = store.index("index")
        const cursorRequest = index.openCursor()

        const cursor = await requestToPromise(cursorRequest)
        expect(cursor).toBeTruthy()
        expect(cursor).toBeInstanceOf(Object) // IDBCursor

        expect(() => {
            cursor!.update(cursor!.value)
        }).toThrow(ReadOnlyError)
    })

    test("Attempt to modify a record in an inactive transaction", async ({
        task,
    }) => {
        const records: Record[] = [
            { pKey: "primaryKey_0", iKey: "indexKey_0" },
            { pKey: "primaryKey_1", iKey: "indexKey_1" },
        ]

        let cursor: IDBCursorWithValue | null = null
        let record: Record | null = null

        await createDatabase(task, (database) => {
            const objStore = database.createObjectStore("test", {
                keyPath: "pKey",
            })
            const index = objStore.createIndex("index", "iKey")

            for (let i = 0; i < records.length; i++) {
                objStore.add(records[i])
            }

            const cursorRequest = index.openCursor()
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

    test("Attempt to modify a record after the cursor's source or effective object store has been deleted", async ({
        task,
    }) => {
        const records: Record[] = [
            { pKey: "primaryKey_0", iKey: "indexKey_0" },
            { pKey: "primaryKey_1", iKey: "indexKey_1" },
        ]

        let cursor: IDBCursorWithValue | null = null

        await createDatabase(task, (database) => {
            const objStore = createObjectStoreWithIndexAndPopulate(
                database,
                records,
            )
            const index = objStore.index("index")
            const cursorRequest = index.openCursor()

            cursorRequest.onsuccess = () => {
                cursor = cursorRequest.result
                if (cursor) {
                    database.deleteObjectStore("test")
                    const updatedValue = { ...cursor.value }
                    updatedValue.iKey += "_updated"

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
            createObjectStoreWithIndexAndPopulate(database, records)
        })

        const tx = db.transaction("test", "readwrite")
        const store = tx.objectStore("test")
        const index = store.index("index")
        const cursorRequest = index.openCursor()

        const cursor = await requestToPromise(cursorRequest)
        expect(cursor).toBeTruthy()
        expect(cursor).toBeInstanceOf(Object) // IDBCursor

        const record: Record & { data?: unknown } = { ...cursor!.value }
        // Add a property that can't be cloned (like self/window in browser)
        record.data = () => {}

        expect(() => {
            cursor!.update(record)
        }).toThrow(DataCloneError)
    })

    test("No argument", async ({ task }) => {
        const records: Record[] = [
            { pKey: "primaryKey_0", iKey: "indexKey_0" },
            { pKey: "primaryKey_1", iKey: "indexKey_1" },
        ]

        const db = await createDatabase(task, (database) => {
            createObjectStoreWithIndexAndPopulate(database, records)
        })

        const tx = db.transaction("test", "readonly")
        const store = tx.objectStore("test")
        const index = store.index("index")
        const cursorRequest = index.openCursor()

        const cursor = await requestToPromise(cursorRequest)
        expect(cursor).toBeTruthy()
        expect(cursor).toBeInstanceOf(Object) // IDBCursor

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
            createObjectStoreWithIndexAndPopulate(database, records)
        })

        const tx = db.transaction("test", "readwrite")
        const store = tx.objectStore("test")
        const index = store.index("index")
        const cursorRequest = index.openCursor()

        const cursor = await requestToPromise(cursorRequest)
        expect(cursor).toBeTruthy()
        expect(cursor).toBeInstanceOf(Object) // IDBCursor

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
            { pKey: "primaryKey_0", iKey: "indexKey_0" },
            { pKey: "primaryKey_1", iKey: "indexKey_1" },
        ]

        const db = await createDatabase(task, (database) => {
            createObjectStoreWithIndexAndPopulate(database, records)
        })

        const tx = db.transaction("test", "readwrite")
        const store = tx.objectStore("test")
        const index = store.index("index")
        const cursorRequest = index.openCursor()

        const cursor = await requestToPromise(cursorRequest)
        expect(cursor).toBeTruthy()
        expect(cursor).toBeInstanceOf(Object) // IDBCursor

        cursor!.continue()

        expect(() => {
            cursor!.update({
                pKey: "primaryKey_0",
                iKey: "indexKey_0_updated",
            })
        }).toThrow(InvalidStateError)
    })

    test("Modify records during cursor iteration and verify updated records", async ({
        task,
    }) => {
        const records: RecordWithNumber[] = [
            { pKey: "primaryKey_1", iKey: 1 },
            { pKey: "primaryKey_2", iKey: 2 },
            { pKey: "primaryKey_3", iKey: 3 },
        ]

        const db = await createDatabase(task, (database) => {
            const objStore = database.createObjectStore("test", {
                keyPath: "pKey",
            })
            objStore.createIndex("index", "iKey")
            for (let i = 0; i < records.length; i++) {
                objStore.add(records[i])
            }
        })

        // First phase: iterate and modify values
        const writeTxn = db.transaction("test", "readwrite")
        const writeStore = writeTxn.objectStore("test")
        const writeIndex = writeStore.index("index")
        const writeCursorRequest = writeIndex.openCursor(
            IDBKeyRange.upperBound(9),
        )

        let writeCursor = await requestToPromise(writeCursorRequest)

        while (writeCursor) {
            const record = { ...writeCursor.value }
            record.iKey += 1
            // Don't await the update request
            writeCursor.update(record)
            writeCursor.continue()
            writeCursor = await requestToPromise(writeCursorRequest)
        }

        // Wait for transaction to complete
        await new Promise<void>((resolve) => {
            writeTxn.oncomplete = () => resolve()
        })

        // Second phase: verify all records were updated correctly
        const readTxn = db.transaction("test", "readonly")
        const readStore = readTxn.objectStore("test")
        const getAllRequest = readStore.getAll()

        const allRecords = await requestToPromise(getAllRequest)
        const iKeyValues = allRecords.map(
            (record: RecordWithNumber) => record.iKey,
        )
        expect(iKeyValues.sort()).toEqual([10, 10, 10])
    })
})
