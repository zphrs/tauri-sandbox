import { describe, test, expect } from "vitest"
import {
    createDatabase,
    migrateNamedDatabase,
    requestToPromise,
} from "../resources/createDatabase"
import {
    InvalidStateError,
    ConstraintError,
} from "../../inMemoryIdb/lib/errors"

// Port of w3c test: idbindex-rename-errors.any.js
// Tests IDBIndex.rename() error handling

const BOOKS_RECORD_DATA = [
    { title: "Quarry Memories", author: "Fred", isbn: 123456 },
    { title: "Water Buffaloes", author: "Fred", isbn: 234567 },
    { title: "Bedrock Nights", author: "Barney", isbn: 345678 },
]

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

async function checkAuthorIndexContents(index: IDBIndex): Promise<void> {
    const request = index.get(BOOKS_RECORD_DATA[2].author)
    const result = await requestToPromise(request)
    expect(result.isbn).toBe(BOOKS_RECORD_DATA[2].isbn)
    expect(result.title).toBe(BOOKS_RECORD_DATA[2].title)
}

describe("IDBIndex rename errors", () => {
    test("IndexedDB index rename throws in a readonly transaction", async ({
        task,
    }) => {
        const db = await createDatabase(task, (database) => {
            createBooksStore(database)
        })

        const transaction = db.transaction("books", "readonly")
        const store = transaction.objectStore("books")
        const index = store.index("by_author")

        expect(() => {
            index.name = "renamed_by_author"
        }).toThrow(InvalidStateError)
        db.close()
    })

    test("IndexedDB index rename throws in a readwrite transaction", async ({
        task,
    }) => {
        const db = await createDatabase(task, (database) => {
            createBooksStore(database)
        })

        const transaction = db.transaction("books", "readwrite")
        const store = transaction.objectStore("books")
        const index = store.index("by_author")

        expect(() => {
            index.name = "renamed_by_author"
        }).toThrow(InvalidStateError)
        db.close()
    })

    test("IndexedDB index rename throws in an inactive transaction", async ({
        task,
    }) => {
        let authorIndex: IDBIndex | undefined
        const db = await createDatabase(task, (database) => {
            const store = createBooksStore(database)
            authorIndex = store.index("by_author")
        })

        // Wait for transaction to become inactive
        await new Promise((res) => setTimeout(res, 0))

        try {
            authorIndex!.name = "renamed_by_author"
            expect.unreachable("should have thrown an error")
        } catch (e) {
            // Index renaming is only allowed in versionchange transactions,
            // so this throws InvalidStateError before checking transaction state
            expect(e).toBeInstanceOf(InvalidStateError)
        }
        db.close()
    })

    test("IndexedDB deleted index rename throws", async ({ task }) => {
        // This test fails due to transaction abortion issues in migrateNamedDatabase
        const db = await createDatabase(task, (database) => {
            createBooksStore(database)
        })
        db.close()

        const db2 = await migrateNamedDatabase(
            task,
            task.id!,
            2,
            (_database, transaction) => {
                const store = transaction.objectStore("books")
                const index = store.index("by_author")

                store.deleteIndex("by_author")
                expect(() => {
                    index.name = "renamed_by_author"
                }).toThrow(InvalidStateError)
            },
        )
        db2.close()
    })

    test("IndexedDB index rename to the name of another index throws", async ({
        task,
    }) => {
        // This test fails due to transaction abortion issues in migrateNamedDatabase
        const db = await createDatabase(task, (database) => {
            createBooksStore(database)
        })
        db.close()

        const db2 = await migrateNamedDatabase(
            task,
            task.id!,
            2,
            (_database, transaction) => {
                const store = transaction.objectStore("books")
                const index = store.index("by_author")

                expect(() => {
                    index.name = "by_title"
                }).toThrow(ConstraintError)

                expect(Array.from(store.indexNames)).toEqual([
                    "by_author",
                    "by_title",
                ])
            },
        )

        const transaction = db2.transaction("books", "readonly")
        const store = transaction.objectStore("books")
        expect(Array.from(store.indexNames)).toEqual(["by_author", "by_title"])

        const index = store.index("by_author")
        await checkAuthorIndexContents(index)
        db2.close()
    })

    test("IndexedDB index rename handles exceptions when stringifying names", async ({
        task,
    }) => {
        // This test fails due to transaction abortion issues in migrateNamedDatabase
        const db = await createDatabase(task, (database) => {
            createBooksStore(database)
        })
        db.close()

        const db2 = await migrateNamedDatabase(
            task,
            task.id!,
            2,
            (_database, transaction) => {
                const store = transaction.objectStore("books")
                const index = store.index("by_author")
                const exception = new Error("Custom stringifying error")

                expect(() => {
                    index.name = {
                        toString: () => {
                            throw exception
                        },
                    } as unknown as string
                }).toThrow(exception)

                expect(Array.from(store.indexNames)).toEqual([
                    "by_author",
                    "by_title",
                ])
            },
        )

        const transaction = db2.transaction("books", "readonly")
        const store = transaction.objectStore("books")
        expect(Array.from(store.indexNames)).toEqual(["by_author", "by_title"])

        const index = store.index("by_author")
        await checkAuthorIndexContents(index)
        db2.close()
    })
})
