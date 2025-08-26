import { describe, expect, test } from "vitest"
import { createDatabase, requestToPromise } from "../resources/createDatabase"

// Port of w3c test: idbcursor_delete_index.any.js
// Tests IDBCursor.delete() method on indexes

interface Record {
    pKey: string
    iKey: string
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

describe("IDBCursor.delete() - index", () => {
    test("Remove a record from the object store", async ({ task }) => {
        const records: Record[] = [
            { pKey: "primaryKey_0", iKey: "indexKey_0" },
            { pKey: "primaryKey_1", iKey: "indexKey_1" },
        ]

        const db = await createDatabase(task, (database) => {
            createObjectStoreWithIndexAndPopulate(database, records)
        })

        // First phase: delete the first record
        const writeTxn = db.transaction("test", "readwrite")
        const writeStore = writeTxn.objectStore("test")
        const writeIndex = writeStore.index("index")
        const writeCursorRequest = writeIndex.openCursor()

        const writeCursor = await requestToPromise(writeCursorRequest)
        expect(writeCursor).toBeTruthy()
        expect(writeCursor).toBeInstanceOf(Object) // IDBCursor

        writeCursor!.delete()

        // Wait for transaction to complete
        await new Promise<void>((resolve) => {
            writeTxn.oncomplete = () => resolve()
        })

        // Second phase: verify record was deleted
        const readTxn = db.transaction("test", "readonly")
        const readStore = readTxn.objectStore("test")
        const readCursorRequest = readStore.openCursor()

        let count = 0
        let readCursor = await requestToPromise(readCursorRequest)

        while (readCursor) {
            expect(readCursor.value.pKey).toBe(records[1].pKey)
            expect(readCursor.value.iKey).toBe(records[1].iKey)
            readCursor.continue()
            count++
            readCursor = await requestToPromise(readCursorRequest)
        }

        expect(count).toBe(1)
    })

    test("Attempt to remove a record in a read-only transaction", async ({
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
            cursor!.delete()
        }).toThrow() // Should throw ReadOnlyError
    })

    test("Attempt to remove a record in an inactive transaction", async ({
        task,
    }) => {
        const records: Record[] = [
            { pKey: "primaryKey_0", iKey: "indexKey_0" },
            { pKey: "primaryKey_1", iKey: "indexKey_1" },
        ]

        return new Promise<void>((resolve, reject) => {
            let cursor: IDBCursorWithValue

            createDatabase(task, (database) => {
                const objStore = createObjectStoreWithIndexAndPopulate(
                    database,
                    records,
                )
                const cursorRequest = objStore.index("index").openCursor()

                cursorRequest.onsuccess = (event) => {
                    cursor = (event.target as IDBRequest).result
                    expect(cursor).toBeInstanceOf(Object) // IDBCursor
                }

                const transaction = (cursorRequest as IDBRequest).transaction!
                transaction.oncomplete = () => {
                    try {
                        expect(() => {
                            cursor.delete()
                        }).toThrow() // Should throw TransactionInactiveError
                        resolve()
                    } catch (error) {
                        reject(error)
                    }
                }
            })
        })
    })

    test("If the cursor's source or effective object store has been deleted, the implementation MUST throw a DOMException of type InvalidStateError", async ({
        task,
    }) => {
        const records: Record[] = [
            { pKey: "primaryKey_0", iKey: "indexKey_0" },
            { pKey: "primaryKey_1", iKey: "indexKey_1" },
        ]

        return new Promise<void>((resolve, reject) => {
            createDatabase(task, (database) => {
                const objStore = createObjectStoreWithIndexAndPopulate(
                    database,
                    records,
                )
                const rq = objStore.index("index").openCursor()

                rq.onsuccess = (event) => {
                    const cursor = (event.target as IDBRequest).result
                    expect(cursor).toBeInstanceOf(Object) // IDBCursor

                    database.deleteObjectStore("test")

                    try {
                        expect(() => {
                            cursor.delete()
                        }).toThrow() // Should throw InvalidStateError
                        resolve()
                    } catch (error) {
                        reject(error)
                    }
                }
            })
        })
    })

    test("Throw InvalidStateError when the cursor is being iterated", async ({
        task,
    }) => {
        const records: Record[] = [
            { pKey: "primaryKey_0", iKey: "indexKey_0" },
            { pKey: "primaryKey_1", iKey: "indexKey_1" },
        ]

        return new Promise<void>((resolve, reject) => {
            createDatabase(task, (database) => {
                const objStore = createObjectStoreWithIndexAndPopulate(
                    database,
                    records,
                )
                const rq = objStore.index("index").openCursor()

                rq.onsuccess = (event) => {
                    const cursor = (event.target as IDBRequest).result
                    expect(cursor).toBeInstanceOf(Object) // IDBCursor

                    cursor.continue()

                    try {
                        expect(() => {
                            cursor.delete()
                        }).toThrow() // Should throw InvalidStateError
                        resolve()
                    } catch (error) {
                        reject(error)
                    }
                }
            })
        })
    })
})
