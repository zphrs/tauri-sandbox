import { describe, test, expect } from "vitest"
import {
    createDatabase,
    requestToPromise,
    migrateNamedDatabase,
} from "../resources/createDatabase"
import {
    InvalidStateError,
    TransactionInactiveError,
    ConstraintError,
} from "../../inMemoryIdb/lib/errors"

// Port of w3c test: idbobjectstore-rename-errors.any.js
// Tests IDBObjectStore.rename error handling

// Helper to create a books store with sample data
function createBooksStore(db: IDBDatabase) {
    const store = db.createObjectStore("books", {
        keyPath: "isbn",
        autoIncrement: true,
    })
    store.createIndex("by_author", "author")
    store.createIndex("by_title", "title", { unique: true })

    // Add sample data
    store.put({ title: "Quarry Memories", author: "Fred" })
    store.put({ title: "Water Buffaloes", author: "Fred" })
    store.put({ title: "Bedrock Nights", author: "Barney" })

    return store
}

// Helper to create a not_books store
function createNotBooksStore(db: IDBDatabase) {
    const store = db.createObjectStore("not_books")
    store.createIndex("not_by_author", "author")
    store.createIndex("not_by_title", "title", { unique: true })
    return store
}

// Helper to check store contents
async function checkStoreContents(store: IDBObjectStore) {
    const request = store.getAll()
    const result = await requestToPromise(request)
    expect(result).toHaveLength(3)
    expect(result[0].title).toBe("Quarry Memories")
    expect(result[0].author).toBe("Fred")
}

describe("IDBObjectStore rename error handling", () => {
    test("IndexedDB deleted object store rename throws", async ({ task }) => {
        const db1 = await createDatabase(task, (db) => {
            createBooksStore(db)
        })
        const dbName = db1.name
        db1.close()

        await migrateNamedDatabase(task, dbName, 2, (db, tx) => {
            const store = tx.objectStore("books")
            db.deleteObjectStore("books")
            expect(() => {
                store.name = "renamed_books"
            }).toThrow(InvalidStateError)
        })
    })

    test("IndexedDB object store rename throws in a readonly transaction", async ({
        task,
    }) => {
        const db = await createDatabase(task, (database) => {
            createBooksStore(database)
        })

        const transaction = db.transaction("books", "readonly")
        const store = transaction.objectStore("books")
        expect(() => {
            store.name = "renamed_books"
        }).toThrow(InvalidStateError)
        db.close()
    })

    test("IndexedDB object store rename throws in a readwrite transaction", async ({
        task,
    }) => {
        const db = await createDatabase(task, (database) => {
            createBooksStore(database)
        })

        const transaction = db.transaction("books", "readwrite")
        const store = transaction.objectStore("books")
        expect(() => {
            store.name = "renamed_books"
        }).toThrow(InvalidStateError)
        db.close()
    })

    test("IndexedDB object store rename throws in an inactive transaction", async ({
        task,
    }) => {
        let bookStore: IDBObjectStore
        const db = await createDatabase(task, (database) => {
            bookStore = createBooksStore(database)
        })

        expect(() => {
            bookStore!.name = "renamed_books"
        }).toThrow(TransactionInactiveError)
        db.close()
    })

    test("IndexedDB object store rename to the name of another store throws", async ({
        task,
    }) => {
        const db1 = await createDatabase(task, (db) => {
            createBooksStore(db)
            createNotBooksStore(db)
        })
        const dbName = db1.name
        db1.close()

        const db2 = await migrateNamedDatabase(task, dbName, 2, (db, _tx) => {
            const store = _tx.objectStore("books")
            expect(() => {
                store.name = "not_books"
            }).toThrow(ConstraintError)
            expect(Array.from(db.objectStoreNames)).toEqual([
                "books",
                "not_books",
            ])
        })

        expect(Array.from(db2.objectStoreNames)).toEqual(["books", "not_books"])
        const transaction = db2.transaction("books", "readonly")
        const store = transaction.objectStore("books")
        await checkStoreContents(store)
        db2.close()
    })

    test("IndexedDB object store rename handles exceptions when stringifying names", async ({
        task,
    }) => {
        const db1 = await createDatabase(task, (db) => {
            createBooksStore(db)
        })
        const dbName = db1.name
        db1.close()

        const db2 = await migrateNamedDatabase(task, dbName, 2, (db, _tx) => {
            const store = _tx.objectStore("books")
            const exception = new Error("Custom stringifying error")
            expect(() => {
                store.name = {
                    toString: () => {
                        throw exception
                    },
                } as unknown as string
            }).toThrow(exception)
            expect(Array.from(db.objectStoreNames)).toEqual(["books"])
        })

        expect(Array.from(db2.objectStoreNames)).toEqual(["books"])
        const transaction = db2.transaction("books", "readonly")
        const store = transaction.objectStore("books")
        await checkStoreContents(store)
        db2.close()
    })
})
