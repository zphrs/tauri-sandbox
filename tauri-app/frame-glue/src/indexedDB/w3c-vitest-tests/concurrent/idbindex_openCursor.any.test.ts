import { describe, expect, test } from "vitest"
import {
    createDatabase,
    idb,
    cleanupDbRefAfterTest,
} from "../resources/createDatabase"
import {
    InvalidStateError,
    TransactionInactiveError,
} from "../../inMemoryIdb/lib/errors"

// Port of w3c test: idbindex_openCursor.any.js
// Tests IDBIndex.openCursor() error conditions

describe("IDBIndex.openCursor()", () => {
    test("If the index is deleted, throw InvalidStateError", async ({
        task,
    }) => {
        await createDatabase(task, (db: IDBDatabase) => {
            const store = db.createObjectStore("store", { keyPath: "key" })
            const index = store.createIndex("index", "indexedProperty")

            store.add({ key: 1, indexedProperty: "data" })
            store.deleteIndex("index")

            expect(() => {
                index.openCursor()
            }).toThrow(InvalidStateError)
        })
    })

    test("If the transaction has been aborted, throw TransactionInactiveError", async ({
        task,
    }) => {
        const db = await createDatabase(task, (db: IDBDatabase) => {
            const store = db.createObjectStore("store", { keyPath: "key" })
            store.createIndex("index", "indexedProperty")
            store.add({ key: 1, indexedProperty: "data" })
        })

        const tx = db.transaction("store", "readonly")
        const index = tx.objectStore("store").index("index")
        tx.abort()

        expect(() => {
            index.openCursor()
        }).toThrow(TransactionInactiveError)
    })

    test("If the index is deleted by an aborted upgrade, throw InvalidStateError", async ({
        task,
    }) => {
        const dbName =
            task.id || "testdb-" + new Date().getTime() + Math.random()
        let index: IDBIndex

        const openReq = idb.open(dbName)
        openReq.onupgradeneeded = () => {
            const db = openReq.result
            const tx = openReq.transaction!
            const store = db.createObjectStore("store", { keyPath: "key" })
            index = store.createIndex("index", "indexedProperty")
            store.add({ key: 1, indexedProperty: "data" })

            tx.abort()

            expect(() => {
                index.openCursor()
            }).toThrow(InvalidStateError)
        }

        // Wait for the error event to be fired
        await new Promise<void>((resolve) => {
            openReq.onerror = () => resolve()
        })

        // Clean up if database was created during the process
        try {
            const db = openReq.result
            if (db) {
                cleanupDbRefAfterTest(db)
            }
        } catch {
            // Database might not have been created due to abort
        }
    })
})
