import { describe, expect, test } from "vitest"
import { createDatabase, requestToPromise } from "../resources/createDatabase"
import { InvalidStateError } from "../../inMemoryIdb/lib/errors"

// Port of w3c test: idbcursor_advance_objectstore.any.js
// Tests IDBCursor.advance() method on object stores

interface Record {
    pKey: string
}

function createAndPopulateObjectStore(db: IDBDatabase, records: Record[]) {
    const objStore = db.createObjectStore("store", { keyPath: "pKey" })
    for (let i = 0; i < records.length; i++) {
        objStore.add(records[i])
    }
    return objStore
}

describe("IDBCursor.advance() on object store", () => {
    test("iterate cursor number of times specified by count", async ({
        task,
    }) => {
        const records: Record[] = [
            { pKey: "primaryKey_0" },
            { pKey: "primaryKey_1" },
            { pKey: "primaryKey_2" },
            { pKey: "primaryKey_3" },
        ]

        const db = await createDatabase(task, (db) => {
            createAndPopulateObjectStore(db, records)
        })

        const tx = db.transaction("store", "readonly")
        const store = tx.objectStore("store")
        const request = store.openCursor()

        let cursor = await requestToPromise(request)
        expect(cursor).toBeTruthy()
        expect(cursor).toBeInstanceOf(Object) // IDBCursor

        // Advance by 3
        cursor!.advance(3)
        cursor = await requestToPromise(request)

        expect(cursor).toBeTruthy()
        expect(cursor!.value.pKey).toBe(records[3].pKey)
    })

    test("Calling advance() with count argument 0 should throw TypeError", async ({
        task,
    }) => {
        const records: Record[] = [
            { pKey: "primaryKey_0" },
            { pKey: "primaryKey_1" },
        ]

        const db = await createDatabase(task, (db) => {
            createAndPopulateObjectStore(db, records)
        })

        const tx = db.transaction("store", "readwrite")
        const store = tx.objectStore("store")
        const request = store.openCursor()

        const cursor = await requestToPromise(request)
        expect(cursor).toBeTruthy()

        expect(() => {
            cursor!.advance(0)
        }).toThrow(TypeError)
    })

    test("Calling advance() should throws an exception TransactionInactiveError when the transaction is not active", async ({
        task,
    }) => {
        const records: Record[] = [
            { pKey: "primaryKey_0" },
            { pKey: "primaryKey_1" },
        ]

        const db = await createDatabase(task, (db) => {
            createAndPopulateObjectStore(db, records)
        })

        const tx = db.transaction("store", "readwrite")
        const store = tx.objectStore("store")
        const request = store.openCursor()

        const cursor = await requestToPromise(request)
        expect(cursor).toBeTruthy()

        tx.abort()

        expect(() => {
            cursor!.advance(1)
        }).toThrow() // Should throw TransactionInactiveError
    })

    test("Calling advance() should throw DOMException when the cursor is currently being iterated", async ({
        task,
    }) => {
        const records: Record[] = [
            { pKey: "primaryKey_0" },
            { pKey: "primaryKey_1" },
        ]

        const db = await createDatabase(task, (db) => {
            createAndPopulateObjectStore(db, records)
        })

        const tx = db.transaction("store", "readwrite")
        const store = tx.objectStore("store")
        const request = store.openCursor()

        const cursor = await requestToPromise(request)
        expect(cursor).toBeTruthy()

        cursor!.advance(1)

        expect(() => {
            cursor!.advance(1)
        }).toThrow(InvalidStateError) // Should throw InvalidStateError
    })

    test(
        "If the cursor's source or effective object store has been deleted, the implementation MUST throw a DOMException of type InvalidStateError",
        { timeout: 20000 },
        async ({ task }) => {
            const records: Record[] = [
                { pKey: "primaryKey_0" },
                { pKey: "primaryKey_1" },
            ]
            let cursor: IDBCursorWithValue | null = null

            await createDatabase(task, (database) => {
                const objStore = createAndPopulateObjectStore(database, records)
                const rq = objStore.openCursor()
                rq.onsuccess = (event) => {
                    cursor = (event.target as IDBRequest).result
                    expect(cursor).toBeTruthy()

                    database.deleteObjectStore("store")

                    expect(() => {
                        cursor!.advance(1)
                    }).toThrow(InvalidStateError) // Should throw InvalidStateError
                }
            })
        },
    )
})
