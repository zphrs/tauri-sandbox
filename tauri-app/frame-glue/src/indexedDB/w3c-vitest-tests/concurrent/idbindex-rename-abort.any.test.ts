import { describe, test, expect } from "vitest"
import {
    createDatabase,
    idb,
    migrateNamedDatabase,
    requestToPromise,
} from "../resources/createDatabase"

// Port of w3c test: idbindex-rename-abort.any.js
// Tests IDBIndex.rename support in aborted transactions

describe("IDBIndex rename in aborted transaction", () => {
    test("IndexedDB index rename in aborted transaction", async ({ task }) => {
        // Create initial database with two indexes
        const db1 = await createDatabase(task, (db) => {
            const store = db.createObjectStore("books")
            store.createIndex("by_author", "author")
            store.createIndex("by_title", "title")
        })
        db1.close()
        // Open versionchange and abort
        const req = idb.open(task.id!, 2)
        req.onupgradeneeded = () => {
            const tx = req.transaction!
            const store = tx.objectStore("books")
            const index = store.index("by_author")
            index.name = "renamed_by_author"
            tx.abort()
            // After abort, name and indexNames should revert
            expect(index.name).toBe("by_author")
            expect(Array.from(store.indexNames)).toEqual([
                "by_author",
                "by_title",
            ])
        }
        // Wait for abort error
        try {
            await requestToPromise(req as unknown as IDBRequest<IDBDatabase>)
            expect.unreachable("open should not succeed")
        } catch {
            // Expected abort
        }
    })

    test("IndexedDB index creation and rename in aborted transaction", async ({
        task,
    }) => {
        // Create initial database with two indexes
        const db2 = await createDatabase(task, (db) => {
            const store = db.createObjectStore("not_books")
            store.createIndex("not_by_author", "author")
            store.createIndex("not_by_title", "title")
        })
        db2.close()
        // Open versionchange to create and rename index then abort
        const promise = migrateNamedDatabase(task, db2.name, 2, (_db, tx) => {
            const store = tx.objectStore("not_books")
            const index = store.createIndex("by_author", "author")
            index.name = "by_author_renamed"
            index.name = "by_author_renamed_again"
            tx.abort()
            // After abort, new index should not persist and rename reverts
            expect(index.name).toBe("by_author_renamed_again")
            expect(Array.from(store.indexNames)).toEqual([
                "not_by_author",
                "not_by_title",
            ])
        })
        // Wait for abort error
        try {
            await promise
            expect.unreachable("open should not succeed")
        } catch {
            // Expected abort
        }
    })
})
