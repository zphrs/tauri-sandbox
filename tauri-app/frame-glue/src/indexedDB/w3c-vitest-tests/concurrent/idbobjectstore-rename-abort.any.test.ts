import { describe, test, expect } from "vitest"
import {
    createDatabase,
    idb,
    requestToPromise,
    cleanupDbRefAfterTest,
    migrateNamedDatabase,
} from "../resources/createDatabase"

// Port of w3c test: idbobjectstore-rename-abort.any.js
// Tests IDBObjectStore.rename support in aborted transactions

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

describe("IDBObjectStore rename in aborted transaction", () => {
    test("IndexedDB object store rename in aborted transaction", async ({
        task,
    }) => {
        const dbName = task.id!
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let bookStore: any
        let bookStore2: IDBObjectStore

        // Create initial database
        const db1 = await createDatabase(task, (db) => {
            createBooksStore(db)
        })

        expect(Array.from(db1.objectStoreNames)).toEqual(["books"])

        const transaction = db1.transaction("books", "readonly")
        bookStore2 = transaction.objectStore("books")
        await checkStoreContents(bookStore2)
        db1.close()

        // Migrate to version 2 and abort
        const req = idb.open(dbName, 2)

        req.onupgradeneeded = () => {
            const db = req.result
            const tx = req.transaction!

            bookStore = tx.objectStore("books")
            bookStore.name = "renamed_books"

            tx.abort()

            expect(bookStore.name).toBe("books")
            expect(Array.from(db.objectStoreNames)).toEqual(["books"])
            expect(Array.from(tx.objectStoreNames)).toEqual(["books"])
        }

        const abortPromise = new Promise((resolve, reject) => {
            req.onerror = () => resolve(undefined)
            req.onsuccess = () => reject(new Error("Should not succeed"))
        })

        await abortPromise

        expect(bookStore!.name).toBe("books")

        // Reopen database at version 1
        const db3 = await requestToPromise(
            idb.open(dbName, 1) as unknown as IDBRequest<IDBDatabase>,
        )
        cleanupDbRefAfterTest(db3)

        expect(Array.from(db3.objectStoreNames)).toEqual(["books"])

        const tx2 = db3.transaction("books", "readonly")
        bookStore2 = tx2.objectStore("books")
        await checkStoreContents(bookStore2)
        db3.close()

        expect(bookStore!.name).toBe("books")
        expect(bookStore2.name).toBe("books")
    })

    test("IndexedDB object store creation and rename in an aborted transaction", async ({
        task,
    }) => {
        const dbName = task.id!
        let notBookStore: IDBObjectStore

        // Create empty database
        const db1 = await createDatabase(task, () => {})
        db1.close()

        // Migrate to version 2 and abort
        let abortHappened = false

        const promise = migrateNamedDatabase(task, db1.name, 2, (db, tx) => {
            notBookStore = createNotBooksStore(db)
            notBookStore.name = "not_books_renamed"
            notBookStore.name = "not_books_renamed_again"

            tx.abort()

            expect(notBookStore.name).toBe("not_books_renamed_again")
            expect(Array.from(db.objectStoreNames)).toEqual([])
            expect(Array.from(tx.objectStoreNames)).toEqual([])
            expect(Array.from(notBookStore.indexNames)).toEqual([])
        })
        try {
            await promise
        } catch {
            abortHappened = true
        }
        expect(abortHappened).toBe(true)

        expect(notBookStore!.name).toBe("not_books_renamed_again")
        expect(Array.from(notBookStore!.indexNames)).toEqual([])

        // Reopen database at version 1
        const db3 = await requestToPromise(
            idb.open(dbName, 1) as unknown as IDBRequest<IDBDatabase>,
        )
        cleanupDbRefAfterTest(db3)

        expect(Array.from(db3.objectStoreNames)).toEqual([])
        db3.close()
    })
})
