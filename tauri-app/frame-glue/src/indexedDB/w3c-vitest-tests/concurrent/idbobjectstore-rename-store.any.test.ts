import { describe, test, expect } from "vitest"
import {
    createDatabase,
    migrateNamedDatabase,
    requestToPromise,
} from "../resources/createDatabase"
import { NotFoundError } from "../../inMemoryIdb/lib/errors"

// Port of w3c test: idbobjectstore-rename-store.any.js
// Tests IDBObjectStore.rename support

const BOOKS_RECORD_DATA = [
    { title: "Quarry Memories", author: "Fred", isbn: 123456 },
    { title: "Water Buffaloes", author: "Fred", isbn: 234567 },
    { title: "Bedrock Nights", author: "Barney", isbn: 345678 },
]

// Helper to create a books store with sample data
function createBooksStore(db: IDBDatabase) {
    const store = db.createObjectStore("books", {
        keyPath: "isbn",
        autoIncrement: true,
    })
    store.createIndex("by_author", "author")
    store.createIndex("by_title", "title", { unique: true })

    for (const record of BOOKS_RECORD_DATA) {
        store.put(record)
    }

    return store
}

// Helper to check store contents
async function checkStoreContents(store: IDBObjectStore) {
    const request = store.get(123456)
    const result = await requestToPromise(request)
    expect(result.isbn).toBe(BOOKS_RECORD_DATA[0].isbn)
    expect(result.author).toBe(BOOKS_RECORD_DATA[0].author)
    expect(result.title).toBe(BOOKS_RECORD_DATA[0].title)
}

describe("IDBObjectStore rename support", () => {
    test("IndexedDB object store rename in new transaction", async ({
        task,
    }) => {
        let bookStore: IDBObjectStore | undefined
        let renamedBookStore: IDBObjectStore | undefined

        const db1 = await createDatabase(task, (database) => {
            bookStore = createBooksStore(database)
        })

        expect(Array.from(db1.objectStoreNames)).toEqual(["books"])
        const transaction = db1.transaction("books", "readonly")
        const bookStore2 = transaction.objectStore("books")
        await checkStoreContents(bookStore2)
        const dbName = db1.name
        db1.close()

        const db2 = await migrateNamedDatabase(
            task,
            dbName,
            2,
            (database, tx) => {
                renamedBookStore = tx.objectStore("books")
                renamedBookStore.name = "renamed_books"

                expect(renamedBookStore.name).toBe("renamed_books")
                expect(Array.from(database.objectStoreNames)).toEqual([
                    "renamed_books",
                ])
                expect(Array.from(tx.objectStoreNames)).toEqual([
                    "renamed_books",
                ])
                expect(tx.objectStore("renamed_books")).toBe(renamedBookStore)
                expect(() => tx.objectStore("books")).toThrow(NotFoundError)
            },
        )

        expect(Array.from(db2.objectStoreNames)).toEqual(["renamed_books"])
        const transaction2 = db2.transaction("renamed_books", "readonly")
        const renamedBookStore2 = transaction2.objectStore("renamed_books")
        await checkStoreContents(renamedBookStore2)
        db2.close()

        expect(bookStore!.name).toBe("books")
        expect(bookStore2.name).toBe("books")
        expect(renamedBookStore!.name).toBe("renamed_books")
        expect(renamedBookStore2.name).toBe("renamed_books")
    })

    test("IndexedDB object store rename in the transaction where it is created", async ({
        task,
    }) => {
        let renamedBookStore: IDBObjectStore | undefined

        const db = await createDatabase(task, (database) => {
            renamedBookStore = createBooksStore(database)
            renamedBookStore.name = "renamed_books"

            expect(renamedBookStore.name).toBe("renamed_books")
            expect(Array.from(database.objectStoreNames)).toEqual([
                "renamed_books",
            ])
        })

        expect(Array.from(db.objectStoreNames)).toEqual(["renamed_books"])
        const transaction = db.transaction("renamed_books", "readonly")
        const renamedBookStore2 = transaction.objectStore("renamed_books")
        await checkStoreContents(renamedBookStore2)
        db.close()

        expect(renamedBookStore!.name).toBe("renamed_books")
        expect(renamedBookStore2.name).toBe("renamed_books")
    })

    test("IndexedDB object store multiple renames succeeds", async ({
        task,
    }) => {
        const db1 = await createDatabase(task, (database) => {
            createBooksStore(database)
        })
        const dbName = db1.name
        db1.close()

        let renamedBookStore: IDBObjectStore
        const db2 = await migrateNamedDatabase(
            task,
            dbName,
            2,
            (database, tx) => {
                renamedBookStore = tx.objectStore("books")
                renamedBookStore.name = "renamed_books"
                renamedBookStore.name = "renamed_books_again"
                renamedBookStore.name = "books"

                expect(renamedBookStore.name).toBe("books")
                expect(Array.from(database.objectStoreNames)).toEqual(["books"])
                expect(Array.from(tx.objectStoreNames)).toEqual(["books"])
            },
        )

        expect(Array.from(db2.objectStoreNames)).toEqual(["books"])
        expect(renamedBookStore!.name).toBe("books")
        db2.close()
    })

    test("IndexedDB object store rename handles Unicode names", async ({
        task,
    }) => {
        const db1 = await createDatabase(task, (database) => {
            createBooksStore(database)
        })
        const dbName = db1.name
        db1.close()

        let renamedBookStore: IDBObjectStore
        const db2 = await migrateNamedDatabase(
            task,
            dbName,
            2,
            (database, tx) => {
                renamedBookStore = tx.objectStore("books")
                renamedBookStore.name = "Ħ€ľľø 🌟"

                expect(renamedBookStore.name).toBe("Ħ€ľľø 🌟")
                expect(Array.from(database.objectStoreNames)).toEqual([
                    "Ħ€ľľø 🌟",
                ])
            },
        )

        expect(Array.from(db2.objectStoreNames)).toEqual(["Ħ€ľľø 🌟"])
        expect(renamedBookStore!.name).toBe("Ħ€ľľø 🌟")
        db2.close()
    })
})
