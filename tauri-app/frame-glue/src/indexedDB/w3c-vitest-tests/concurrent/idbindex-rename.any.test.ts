import { describe, expect, test } from "vitest"
import {
    createDatabase,
    requestToPromise,
    migrateNamedDatabase,
} from "../resources/createDatabase"
import { NotFoundError } from "../../inMemoryIdb/lib/errors"

// Port of w3c test: idbindex-rename.any.js
// Tests IDBIndex name property and renaming functionality

// The data in the 'books' object store records in the first example of the
// IndexedDB specification.
const BOOKS_RECORD_DATA = [
    { title: "Quarry Memories", author: "Fred", isbn: 123456 },
    { title: "Water Buffaloes", author: "Fred", isbn: 234567 },
    { title: "Bedrock Nights", author: "Barney", isbn: 345678 },
]

// Creates a 'books' object store whose contents closely resembles the first
// example in the IndexedDB specification.
function createBooksStore(database: IDBDatabase): IDBObjectStore {
    const store = database.createObjectStore("books", {
        keyPath: "isbn",
        autoIncrement: true,
    })
    store.createIndex("by_author", "author")
    store.createIndex("by_title", "title", { unique: true })
    for (const record of BOOKS_RECORD_DATA) store.put(record)
    return store
}

// Verifies that index matches the 'by_author' index used to create the
// by_author books store in the test database's version 1.
async function checkAuthorIndexContents(index: IDBIndex) {
    const request = index.get(BOOKS_RECORD_DATA[2].author)
    const result = await requestToPromise(request)
    expect(result.isbn).toBe(BOOKS_RECORD_DATA[2].isbn)
    expect(result.title).toBe(BOOKS_RECORD_DATA[2].title)
}

// Verifies that an index matches the 'by_title' index used to create the books
// store in the test database's version 1.
async function checkTitleIndexContents(index: IDBIndex) {
    const request = index.get(BOOKS_RECORD_DATA[2].title)
    const result = await requestToPromise(request)
    console.log(request, result)
    expect(result.isbn).toBe(BOOKS_RECORD_DATA[2].isbn)
    expect(result.author).toBe(BOOKS_RECORD_DATA[2].author)
}

describe("IDBIndex rename", () => {
    test("IndexedDB index rename in new transaction", async ({ task }) => {
        let authorIndex: IDBIndex | null = null
        let authorIndex2: IDBIndex | null = null
        let renamedAuthorIndex: IDBIndex | null = null
        let renamedAuthorIndex2: IDBIndex | null = null

        const db = await createDatabase(task, (database: IDBDatabase) => {
            const store = createBooksStore(database)
            authorIndex = store.index("by_author")
        })

        const transaction = db.transaction("books", "readonly")
        const store = transaction.objectStore("books")
        expect(Array.from(store.indexNames)).toEqual(["by_author", "by_title"])

        authorIndex2 = store.index("by_author")
        await checkAuthorIndexContents(authorIndex2)

        db.close()

        const db2 = await migrateNamedDatabase(
            task,
            db.name,
            2,
            (_database: IDBDatabase, transaction: IDBTransaction) => {
                const store = transaction.objectStore("books")
                renamedAuthorIndex = store.index("by_author")
                renamedAuthorIndex.name = "renamed_by_author"

                expect(renamedAuthorIndex.name).toBe("renamed_by_author")
                expect(Array.from(store.indexNames)).toEqual([
                    "by_title",
                    "renamed_by_author",
                ])
                expect(store.index("renamed_by_author")).toBe(
                    renamedAuthorIndex,
                )
                expect(() => store.index("by_author")).toThrow(NotFoundError)
            },
        )

        const transaction2 = db2.transaction("books", "readonly")
        const store2 = transaction2.objectStore("books")
        expect(Array.from(store2.indexNames)).toEqual([
            "by_title",
            "renamed_by_author",
        ])

        renamedAuthorIndex2 = store2.index("renamed_by_author")
        await checkAuthorIndexContents(renamedAuthorIndex2)

        db2.close()

        expect(authorIndex!.name).toBe("by_author")
        expect(authorIndex2!.name).toBe("by_author")
        expect(renamedAuthorIndex!.name).toBe("renamed_by_author")
        expect(renamedAuthorIndex2!.name).toBe("renamed_by_author")
    })

    test("IndexedDB index rename in the transaction where it is created", async ({
        task,
    }) => {
        let renamedAuthorIndex: IDBIndex | null = null
        let renamedAuthorIndex2: IDBIndex | null = null

        const db = await createDatabase(task, (database: IDBDatabase) => {
            const store = createBooksStore(database)
            renamedAuthorIndex = store.index("by_author")
            renamedAuthorIndex.name = "renamed_by_author"

            expect(renamedAuthorIndex.name).toBe("renamed_by_author")
            expect(Array.from(store.indexNames)).toEqual([
                "by_title",
                "renamed_by_author",
            ])
            expect(store.index("renamed_by_author")).toBe(renamedAuthorIndex)
            expect(() => store.index("by_author")).toThrow(NotFoundError)
        })

        const transaction = db.transaction("books", "readonly")
        const store = transaction.objectStore("books")
        expect(Array.from(store.indexNames)).toEqual([
            "by_title",
            "renamed_by_author",
        ])

        renamedAuthorIndex2 = store.index("renamed_by_author")
        await checkAuthorIndexContents(renamedAuthorIndex2)

        db.close()

        expect(renamedAuthorIndex!.name).toBe("renamed_by_author")
        expect(renamedAuthorIndex2!.name).toBe("renamed_by_author")
    })

    test("IndexedDB index rename to the same name succeeds", async ({
        task,
    }) => {
        const db = await createDatabase(task, (database: IDBDatabase) => {
            createBooksStore(database)
        })

        db.close()

        const db2 = await migrateNamedDatabase(
            task,
            db.name,
            2,
            (_database: IDBDatabase, transaction: IDBTransaction) => {
                const store = transaction.objectStore("books")
                const index = store.index("by_author")
                index.name = "by_author"
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

    test("IndexedDB index rename to the name of a deleted index succeeds", async ({
        task,
    }) => {
        const db = await createDatabase(task, (database: IDBDatabase) => {
            createBooksStore(database)
        })

        db.close()

        const db2 = await migrateNamedDatabase(
            task,
            db.name,
            2,
            (_database: IDBDatabase, transaction: IDBTransaction) => {
                const store = transaction.objectStore("books")
                const index = store.index("by_author")
                store.deleteIndex("by_title")
                index.name = "by_title"
                expect(Array.from(store.indexNames)).toEqual(["by_title"])
            },
        )

        const transaction = db2.transaction("books", "readonly")
        const store = transaction.objectStore("books")
        expect(Array.from(store.indexNames)).toEqual(["by_title"])

        const index = store.index("by_title")
        await checkAuthorIndexContents(index)

        db2.close()
    })

    test("IndexedDB index swapping via renames succeeds", async ({ task }) => {
        const db = await createDatabase(task, (database: IDBDatabase) => {
            createBooksStore(database)
        })

        db.close()

        const db2 = await migrateNamedDatabase(
            task,
            db.name,
            2,
            async (_database: IDBDatabase, transaction: IDBTransaction) => {
                const store = transaction.objectStore("books")
                store.index("by_author").name = "tmp"
                store.index("by_title").name = "by_author"
                store.index("tmp").name = "by_title"
                expect(Array.from(store.indexNames)).toEqual([
                    "by_author",
                    "by_title",
                ])

                // Check that the swapped index has the correct contents
                await checkTitleIndexContents(store.index("by_author"))
            },
        )

        const transaction = db2.transaction("books", "readonly")
        const store = transaction.objectStore("books")
        expect(Array.from(store.indexNames)).toEqual(["by_author", "by_title"])

        const index = store.index("by_title")
        await checkAuthorIndexContents(index)

        db2.close()
    })

    test("IndexedDB index rename stringifies non-string names", async ({
        task,
    }) => {
        const db = await createDatabase(task, (database: IDBDatabase) => {
            createBooksStore(database)
        })

        db.close()

        const db2 = await migrateNamedDatabase(
            task,
            db.name,
            2,
            (_database: IDBDatabase, transaction: IDBTransaction) => {
                const store = transaction.objectStore("books")
                const index = store.index("by_author")

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                index.name = 42 as any
                expect(index.name).toBe("42")
                expect(Array.from(store.indexNames)).toEqual(["42", "by_title"])

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                index.name = true as any
                expect(index.name).toBe("true")

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                index.name = {} as any
                expect(index.name).toBe("[object Object]")

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                index.name = (() => null) as any
                expect(index.name).toBe("() => null")

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                index.name = undefined as any
                expect(index.name).toBe("undefined")
            },
        )

        const transaction = db2.transaction("books", "readonly")
        const store = transaction.objectStore("books")
        expect(Array.from(store.indexNames)).toEqual(["by_title", "undefined"])

        const index = store.index("undefined")
        await checkAuthorIndexContents(index)

        db2.close()
    })

    const specialNames = [
        ["", '""'],
        ["\\u0000", '"\\u0000"'],
        ["\\uDC00\\uD800", '"\\uDC00\\uD800"'],
    ]

    for (const [escapedName, description] of specialNames) {
        test(`IndexedDB index can be renamed to ${description}`, async ({
            task,
        }) => {
            const name = JSON.parse('"' + escapedName + '"')

            const db = await createDatabase(task, (database: IDBDatabase) => {
                createBooksStore(database)
            })

            db.close()

            const db2 = await migrateNamedDatabase(
                task,
                db.name,
                2,
                (_database: IDBDatabase, transaction: IDBTransaction) => {
                    const store = transaction.objectStore("books")
                    const index = store.index("by_author")

                    index.name = name
                    expect(index.name).toBe(name)
                    expect(Array.from(store.indexNames).sort()).toEqual(
                        [name, "by_title"].sort(),
                    )
                },
            )

            const transaction = db2.transaction("books", "readonly")
            const store = transaction.objectStore("books")
            expect(Array.from(store.indexNames).sort()).toEqual(
                [name, "by_title"].sort(),
            )

            const index = store.index(name)
            await checkAuthorIndexContents(index)

            db2.close()
        })
    }
})
