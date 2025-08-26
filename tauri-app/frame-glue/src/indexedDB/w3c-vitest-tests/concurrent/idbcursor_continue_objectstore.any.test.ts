import { describe, expect, test } from "vitest"
import { createDatabase, requestToPromise } from "../resources/createDatabase"

// Port of w3c test: idbcursor_continue_objectstore.any.js
// Tests IDBCursor.continue() method on object stores

interface Record {
    pKey: string
    iKey?: string
}

function createObjectStoreAndPopulate(db: IDBDatabase, records: Record[]) {
    const objStore = db.createObjectStore("test", { keyPath: "pKey" })
    for (let i = 0; i < records.length; i++) {
        objStore.add(records[i])
    }
    return objStore
}

describe("IDBCursor.continue() - object store", () => {
    test("Iterate to the next record", async ({ task }) => {
        const records: Record[] = [
            { pKey: "primaryKey_0" },
            { pKey: "primaryKey_1" },
        ]

        const db = await createDatabase(task, (database) => {
            createObjectStoreAndPopulate(database, records)
        })

        const store = db.transaction("test", "readonly").objectStore("test")
        const cursorRequest = store.openCursor()
        for (const record of records) {
            const cursor = await requestToPromise(cursorRequest)
            expect(cursor).not.toBeNull()
            if (cursor === null) break
            expect(cursor.value.pKey).toBe(record.pKey)
            expect(cursor.value.iKey).toBe(record.iKey)
            cursor.continue()
        }
        const cursor = await requestToPromise(cursorRequest)

        expect(cursor).toBeNull()
    })

    test("Attempt to pass a key parameter is not a valid key", async ({
        task,
    }) => {
        const records: Record[] = [
            { pKey: "primaryKey_0" },
            { pKey: "primaryKey_1" },
        ]

        const db = await createDatabase(task, (database) => {
            createObjectStoreAndPopulate(database, records)
        })

        const tx = db.transaction("test", "readonly")
        const store = tx.objectStore("test")
        const cursorRequest = store.openCursor()

        const cursor = await requestToPromise(cursorRequest)
        expect(cursor).toBeTruthy()
        expect(cursor).toBeInstanceOf(Object) // IDBCursor

        expect(() => {
            cursor!.continue(-1 as IDBValidKey)
        }).toThrow() // Should throw DataError
    })

    test("Attempt to iterate to the previous record when the direction is set for the next record", async ({
        task,
    }) => {
        const records: Record[] = [
            { pKey: "primaryKey_0" },
            { pKey: "primaryKey_1" },
        ]

        const db = await createDatabase(task, (database) => {
            createObjectStoreAndPopulate(database, records)
        })

        const tx = db.transaction("test", "readonly")
        const store = tx.objectStore("test")
        const cursorRequest = store.openCursor(undefined, "next")

        const cursor = await requestToPromise(cursorRequest)
        expect(cursor).toBeTruthy()
        expect(cursor).toBeInstanceOf(Object) // IDBCursor

        expect(() => {
            cursor!.continue(records[0].pKey)
        }).toThrow() // Should throw DataError
    })

    test("Attempt to iterate to the next record when the direction is set for the previous record", async ({
        task,
    }) => {
        const records: Record[] = [
            { pKey: "primaryKey_0" },
            { pKey: "primaryKey_1" },
            { pKey: "primaryKey_2" },
        ]

        const db = await createDatabase(task, (database) => {
            createObjectStoreAndPopulate(database, records)
        })

        const tx = db.transaction("test", "readonly")
        const store = tx.objectStore("test")
        const cursorRequest = store.openCursor(null, "prev")

        let count = 0
        let cursor = await requestToPromise(cursorRequest)

        while (cursor && count < 2) {
            expect(cursor).not.toBeNull()

            for (let i = records.length - 1; i >= 0; i--) {
                if (count === records.length - 1 - i) {
                    expect(cursor.value.pKey).toBe(records[i].pKey)
                    if (i > 0) {
                        cursor.continue(records[i - 1].pKey)
                    } else {
                        expect(() => {
                            cursor!.continue(records[i + 1].pKey)
                        }).toThrow() // Should throw DataError
                        return // Exit test
                    }
                }
            }

            count++
            cursor = await requestToPromise(cursorRequest)
        }
    })

    test("Calling continue() should throws an exception TransactionInactiveError when the transaction is not active", async ({
        task,
    }) => {
        const records: Record[] = [
            { pKey: "primaryKey_0" },
            { pKey: "primaryKey_1" },
        ]

        const db = await createDatabase(task, (database) => {
            createObjectStoreAndPopulate(database, records)
        })

        const tx = db.transaction("test", "readonly")
        const store = tx.objectStore("test")
        const cursorRequest = store.openCursor()

        const cursor = await requestToPromise(cursorRequest)
        expect(cursor).toBeTruthy()
        expect(cursor).toBeInstanceOf(Object) // IDBCursor

        tx.abort()

        expect(() => {
            cursor!.continue()
        }).toThrow() // Should throw TransactionInactiveError
    })

    test("If the cursor's source or effective object store has been deleted, the implementation MUST throw a DOMException of type InvalidStateError", async ({
        task,
    }) => {
        const records: Record[] = [
            { pKey: "primaryKey_0" },
            { pKey: "primaryKey_1" },
        ]

        return new Promise<void>((resolve, reject) => {
            createDatabase(task, (database) => {
                const objStore = createObjectStoreAndPopulate(database, records)
                const cursorRequest = objStore.openCursor()

                cursorRequest.onsuccess = (event) => {
                    const cursor = (event.target as IDBRequest).result
                    expect(cursor).toBeInstanceOf(Object) // IDBCursor

                    database.deleteObjectStore("test")

                    try {
                        expect(() => {
                            cursor.continue()
                        }).toThrow() // Should throw InvalidStateError
                        resolve()
                    } catch (error) {
                        reject(error)
                    }
                }
            })
        })
    })

    test("Delete next element, and iterate to it", async ({ task }) => {
        const records: Record[] = [
            { pKey: "primaryKey_0" },
            { pKey: "primaryKey_1" },
            { pKey: "primaryKey_2" },
        ]

        const expectedRecords: Record[] = [
            { pKey: "primaryKey_0" },
            { pKey: "primaryKey_2" },
        ]

        const db = await createDatabase(task, (database) => {
            createObjectStoreAndPopulate(database, records)
        })

        const tx = db.transaction("test", "readwrite")
        const store = tx.objectStore("test")
        const cursorRequest = store.openCursor()

        let cursor = await requestToPromise(cursorRequest)
        expect(cursor).not.toBeNull()
        {
            const record = cursor!.value
            if (record.pKey === "primaryKey_0") {
                store.delete("primaryKey_1")
            }
            expect(record.pKey).toBe(expectedRecords[0].pKey)
            cursor!.continue()
        }

        cursor = await requestToPromise(cursorRequest)
        expect(cursor).not.toBeNull()
        {
            const record = cursor!.value
            expect(record.pKey).toBe(expectedRecords[1].pKey)

            cursor!.continue()
        }
        cursor = await requestToPromise(cursorRequest)
        expect(cursor).toBeNull()
    })

    test("Add next element, and iterate to it", async ({ task }) => {
        const records: Record[] = [
            { pKey: "primaryKey_0" },
            { pKey: "primaryKey_2" },
        ]

        const expectedRecords: Record[] = [
            { pKey: "primaryKey_0" },
            { pKey: "primaryKey_1" },
            { pKey: "primaryKey_2" },
        ]

        const db = await createDatabase(task, (database) => {
            createObjectStoreAndPopulate(database, records)
        })

        const tx = db.transaction("test", "readwrite")
        const store = tx.objectStore("test")
        const cursorRequest = store.openCursor()

        let count = 0
        let cursor = await requestToPromise(cursorRequest)

        while (cursor) {
            const record = cursor.value
            if (record.pKey === "primaryKey_0") {
                store.add({ pKey: "primaryKey_1" })
            }
            expect(record.pKey).toBe(expectedRecords[count].pKey)

            cursor.continue()
            count++
            cursor = await requestToPromise(cursorRequest)
        }

        expect(count).toBe(3)
    })
})
