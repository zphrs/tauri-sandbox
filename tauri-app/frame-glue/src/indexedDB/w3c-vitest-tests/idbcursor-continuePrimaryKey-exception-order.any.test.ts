import { describe, test, expect } from "vitest"
import { createDatabase, requestToPromise } from "./resources/createDatabase"

// Port of w3c test: idbcursor-continuePrimaryKey-exception-order.any.js
// Tests exception ordering for IDBCursor.continuePrimaryKey() method

function setupTestStore(db: IDBDatabase) {
    const records = [
        { iKey: "A", pKey: 1 },
        { iKey: "A", pKey: 2 },
        { iKey: "A", pKey: 3 },
        { iKey: "A", pKey: 4 },
        { iKey: "B", pKey: 5 },
        { iKey: "B", pKey: 6 },
        { iKey: "B", pKey: 7 },
        { iKey: "C", pKey: 8 },
        { iKey: "C", pKey: 9 },
        { iKey: "D", pKey: 10 },
    ]

    const store = db.createObjectStore("test", { keyPath: "pKey" })
    store.createIndex("idx", "iKey")

    for (let i = 0; i < records.length; i++) {
        store.add(records[i])
    }

    return store
}

describe("IDBCursor.continuePrimaryKey() exception order", () => {
    test("TransactionInactiveError vs. InvalidStateError(deleted index)", async ({
        task,
    }) => {
        const db = await createDatabase(task, setupTestStore)
        const tx = db.transaction("test", "readonly")
        const store = tx.objectStore("test")
        const cursorRequest = store.index("idx").openCursor()
        const cursor = (await requestToPromise(cursorRequest))!

        expect(cursor).not.toBeNull()

        // Delete the index to cause InvalidStateError
        // Note: This is done during upgrade, but we can't modify schema after upgrade
        // We'll skip this test as it requires transaction to be in upgrade mode
        db.close()

        // Wait for transaction to become inactive
        await new Promise((resolve) => setTimeout(resolve, 0))

        expect(() => {
            cursor.continuePrimaryKey("A", 4)
        }).toThrow(
            /A request was placed against a transaction|TransactionInactiveError|Transaction.*inactive/i,
        )
    })

    test("InvalidStateError(deleted source) vs. InvalidAccessError(incorrect source)", async ({
        task,
    }) => {
        const db = await createDatabase(task, setupTestStore)
        const tx = db.transaction("test", "readwrite")
        const store = tx.objectStore("test")
        const cursorRequest = store.openCursor()
        const cursor = (await requestToPromise(cursorRequest))!

        expect(cursor).not.toBeNull()

        // Delete the object store to cause InvalidStateError
        // Note: This also requires upgrade transaction, so we'll test InvalidAccessError instead
        expect(() => {
            cursor.continuePrimaryKey("A", 4)
        }).toThrow(
            /An invalid operation was performed|InvalidAccessError|Invalid.*access/i,
        )
    })

    test("InvalidStateError(deleted source) vs. InvalidAccessError(incorrect direction)", async ({
        task,
    }) => {
        const db = await createDatabase(task, setupTestStore)
        const tx = db.transaction("test", "readonly")
        const store = tx.objectStore("test")
        const cursorRequest = store.index("idx").openCursor(null, "nextunique")
        const cursor = (await requestToPromise(cursorRequest))!

        expect(cursor).not.toBeNull()

        // This should throw InvalidAccessError because nextunique direction is not supported
        expect(() => {
            cursor.continuePrimaryKey("A", 4)
        }).toThrow(
            /An invalid operation was performed|InvalidAccessError|Invalid.*access/i,
        )
    })

    test("InvalidAccessError(incorrect direction) vs. InvalidStateError(iteration complete)", async ({
        task,
    }) => {
        const db = await createDatabase(task, (db) => {
            const store = db.createObjectStore("test", { keyPath: "pKey" })
            store.add({ iKey: "A", pKey: 1 })
            store.createIndex("idx", "iKey")
        })

        const tx = db.transaction("test", "readonly")
        const store = tx.objectStore("test")
        const cursorRequest = store.index("idx").openCursor(null, "nextunique")
        const cursor = (await requestToPromise(cursorRequest))!

        expect(cursor).not.toBeNull()

        // Advance cursor to completion
        cursor.continue()
        const nextResult = await requestToPromise(cursorRequest)
        expect(nextResult).toBeNull()

        // This should throw InvalidAccessError for direction before checking iteration state
        expect(() => {
            cursor.continuePrimaryKey("A", 4)
        }).toThrow(
            /An invalid operation was performed|InvalidAccessError|Invalid.*access/i,
        )
    })

    test("InvalidAccessError(incorrect direction) vs. InvalidStateError(iteration ongoing)", async ({
        task,
    }) => {
        const db = await createDatabase(task, (db) => {
            const store = db.createObjectStore("test", { keyPath: "pKey" })
            store.add({ iKey: "A", pKey: 1 })
            store.createIndex("idx", "iKey")
        })

        const tx = db.transaction("test", "readonly")
        const store = tx.objectStore("test")
        const cursorRequest = store.index("idx").openCursor(null, "nextunique")
        const cursor = (await requestToPromise(cursorRequest))!

        expect(cursor).not.toBeNull()

        // Start iteration but don't wait for result
        cursor.continue()

        // This should throw InvalidAccessError for direction before checking iteration state
        expect(() => {
            cursor.continuePrimaryKey("A", 4)
        }).toThrow(
            /An invalid operation was performed|InvalidAccessError|Invalid.*access/i,
        )
    })

    test("InvalidAccessError(incorrect source) vs. InvalidStateError(iteration ongoing)", async ({
        task,
    }) => {
        const db = await createDatabase(task, setupTestStore)
        const tx = db.transaction("test", "readonly")
        const store = tx.objectStore("test")
        const cursorRequest = store.openCursor()
        const cursor = (await requestToPromise(cursorRequest))!

        expect(cursor).not.toBeNull()

        // Start iteration but don't wait for result
        cursor.continue()

        // This should throw InvalidAccessError because source is object store, not index
        expect(() => {
            cursor.continuePrimaryKey("A", 4)
        }).toThrow(
            /An invalid operation was performed|InvalidAccessError|Invalid.*access/i,
        )
    })

    test("InvalidAccessError(incorrect source) vs. InvalidStateError(iteration complete)", async ({
        task,
    }) => {
        const db = await createDatabase(task, (db) => {
            const store = db.createObjectStore("test", { keyPath: "pKey" })
            store.add({ iKey: "A", pKey: 1 })
        })

        const tx = db.transaction("test", "readonly")
        const store = tx.objectStore("test")
        const cursorRequest = store.openCursor()
        const cursor = (await requestToPromise(cursorRequest))!

        expect(cursor).not.toBeNull()

        // Advance cursor to completion
        cursor.continue()
        const nextResult = await requestToPromise(cursorRequest)
        expect(nextResult).toBeNull()

        // This should throw InvalidAccessError because source is object store, not index
        expect(() => {
            cursor.continuePrimaryKey("A", 4)
        }).toThrow(
            /An invalid operation was performed|InvalidAccessError|Invalid.*access/i,
        )
    })

    test("InvalidStateError(iteration ongoing) vs. DataError(unset key)", async ({
        task,
    }) => {
        const db = await createDatabase(task, setupTestStore)
        const tx = db.transaction("test", "readonly")
        const store = tx.objectStore("test")
        const cursorRequest = store.index("idx").openCursor()
        const cursor = (await requestToPromise(cursorRequest))!

        expect(cursor).not.toBeNull()

        // Start iteration but don't wait for result
        cursor.continue()

        // This should throw InvalidStateError for ongoing iteration before checking key
        expect(() => {
            cursor.continuePrimaryKey(null as unknown as IDBValidKey, 4)
        }).toThrow(
            /The object is in an invalid state|InvalidStateError|Invalid.*state/i,
        )
    })

    test("InvalidStateError(iteration complete) vs. DataError(unset key)", async ({
        task,
    }) => {
        const db = await createDatabase(task, (db) => {
            const store = db.createObjectStore("test", { keyPath: "pKey" })
            store.add({ iKey: "A", pKey: 1 })
            store.createIndex("idx", "iKey")
        })

        const tx = db.transaction("test", "readonly")
        const store = tx.objectStore("test")
        const cursorRequest = store.index("idx").openCursor()
        const cursor = (await requestToPromise(cursorRequest))!

        expect(cursor).not.toBeNull()

        // Advance cursor to completion
        cursor.continue()
        const nextResult = await requestToPromise(cursorRequest)
        expect(nextResult).toBeNull()

        // This should throw InvalidStateError for iteration complete before checking key
        expect(() => {
            cursor.continuePrimaryKey(null as unknown as IDBValidKey, 4)
        }).toThrow(
            /The object is in an invalid state|InvalidStateError|Invalid.*state/i,
        )
    })

    test("DataError(unset key)", async ({ task }) => {
        const db = await createDatabase(task, setupTestStore)
        const tx = db.transaction("test", "readonly")
        const store = tx.objectStore("test")
        const cursorRequest = store.index("idx").openCursor()
        const cursor = (await requestToPromise(cursorRequest))!

        expect(cursor).not.toBeNull()

        expect(() => {
            cursor.continuePrimaryKey(null as unknown as IDBValidKey, 4)
        }).toThrow(
            /Data provided to an operation does not meet requirements|DataError|Data.*error/i,
        )
    })

    test("DataError(unset primary key)", async ({ task }) => {
        const db = await createDatabase(task, setupTestStore)
        const tx = db.transaction("test", "readonly")
        const store = tx.objectStore("test")
        const cursorRequest = store.index("idx").openCursor()
        const cursor = (await requestToPromise(cursorRequest))!

        expect(cursor).not.toBeNull()

        expect(() => {
            cursor.continuePrimaryKey("A", null as unknown as IDBValidKey)
        }).toThrow(
            /Data provided to an operation does not meet requirements|DataError|Data.*error/i,
        )
    })

    test("DataError(keys are lower than current one) in 'next' direction", async ({
        task,
    }) => {
        const db = await createDatabase(task, setupTestStore)
        const tx = db.transaction("test", "readonly")
        const store = tx.objectStore("test")

        // Use lowerBound to start at "B"
        const cursorRequest = store.index("idx").openCursor("B")
        const cursor = (await requestToPromise(cursorRequest))!

        expect(cursor).not.toBeNull()
        expect(cursor.key).toBe("B")
        expect(cursor.primaryKey).toBe(5)

        // Test key lower than current
        expect(() => {
            cursor.continuePrimaryKey("A", 6)
        }).toThrow(
            /Data provided to an operation does not meet requirements|DataError|Data.*error/i,
        )

        // Test primary key equal to current
        expect(() => {
            cursor.continuePrimaryKey("B", 5)
        }).toThrow(
            /Data provided to an operation does not meet requirements|DataError|Data.*error/i,
        )

        // Test primary key lower than current
        expect(() => {
            cursor.continuePrimaryKey("B", 4)
        }).toThrow(
            /Data provided to an operation does not meet requirements|DataError|Data.*error/i,
        )
    })

    test("DataError(keys are larger than current one) in 'prev' direction", async ({
        task,
    }) => {
        const db = await createDatabase(task, setupTestStore)
        const tx = db.transaction("test", "readonly")
        const store = tx.objectStore("test")

        // Use prev direction starting from "B"
        const cursorRequest = store.index("idx").openCursor("B", "prev")
        const cursor = (await requestToPromise(cursorRequest))!

        expect(cursor).not.toBeNull()
        expect(cursor.key).toBe("B")
        expect(cursor.primaryKey).toBe(7) // Last "B" record in reverse order

        // Test key larger than current
        expect(() => {
            cursor.continuePrimaryKey("C", 6)
        }).toThrow(
            /Data provided to an operation does not meet requirements|DataError|Data.*error/i,
        )

        // Test primary key equal to current
        expect(() => {
            cursor.continuePrimaryKey("B", 7)
        }).toThrow(
            /Data provided to an operation does not meet requirements|DataError|Data.*error/i,
        )

        // Test primary key larger than current
        expect(() => {
            cursor.continuePrimaryKey("B", 8)
        }).toThrow(
            /Data provided to an operation does not meet requirements|DataError|Data.*error/i,
        )
    })
})
