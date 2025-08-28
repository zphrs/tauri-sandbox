import { describe, expect, test } from "vitest"
import {
    createDatabase,
    requestToPromise,
    idb,
} from "../resources/createDatabase"
import { FDBKeyRange as IDBKeyRange } from "../../inMemoryIdb"
import {
    DataError,
    TransactionInactiveError,
} from "../../inMemoryIdb/lib/errors"

// Port of w3c test: idbobjectstore_openKeyCursor.any.js
// Tests IDBObjectStore.openKeyCursor() method functionality

async function createStoreWithData(db: IDBDatabase) {
    const objectStore = db.createObjectStore("store")
    for (let i = 0; i < 10; i++) {
        objectStore.put("value: " + i, i)
    }
}

describe("IDBObjectStore.openKeyCursor()", () => {
    test("forward iteration", async ({ task }) => {
        const db = await createDatabase(task, createStoreWithData)

        const tx = db.transaction("store", "readonly")
        const objectStore = tx.objectStore("store")
        const request = objectStore.openKeyCursor()

        const expected = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
        const actual: IDBValidKey[] = []

        let cursor = await requestToPromise(request)
        while (cursor) {
            expect(cursor.direction).toBe("next")
            expect("value" in cursor).toBe(false)
            expect(idb.cmp(cursor.key, cursor.primaryKey)).toBe(0)
            actual.push(cursor.key)
            cursor.continue()
            cursor = await requestToPromise(request)
        }

        expect(actual).toEqual(expected)
    })

    test("reverse iteration", async ({ task }) => {
        const db = await createDatabase(task, createStoreWithData)

        const tx = db.transaction("store", "readonly")
        const objectStore = tx.objectStore("store")
        const request = objectStore.openKeyCursor(null, "prev")

        const expected = [9, 8, 7, 6, 5, 4, 3, 2, 1, 0]
        const actual: IDBValidKey[] = []

        let cursor = await requestToPromise(request)
        while (cursor) {
            expect(cursor.direction).toBe("prev")
            expect("value" in cursor).toBe(false)
            expect(idb.cmp(cursor.key, cursor.primaryKey)).toBe(0)
            actual.push(cursor.key)
            cursor.continue()
            cursor = await requestToPromise(request)
        }

        expect(actual).toEqual(expected)
    })

    test("forward iteration with range", async ({ task }) => {
        const db = await createDatabase(task, createStoreWithData)

        const tx = db.transaction("store", "readonly")
        const objectStore = tx.objectStore("store")
        const request = objectStore.openKeyCursor(IDBKeyRange.bound(4, 6))

        const expected = [4, 5, 6]
        const actual: IDBValidKey[] = []

        let cursor = await requestToPromise(request)

        for (const expectedKey of expected) {
            expect(cursor).toBeTruthy()
            expect(cursor!.direction).toBe("next")
            expect("value" in cursor!).toBe(false)
            expect(idb.cmp(cursor!.key, cursor!.primaryKey)).toBe(0)
            expect(cursor!.key).toBe(expectedKey)
            actual.push(cursor!.key)
            cursor!.continue()
            cursor = await requestToPromise(request)
        }

        // Verify cursor is exhausted
        expect(cursor).toBe(null)

        expect(actual).toEqual(expected)
    })

    test("reverse iteration with range", async ({ task }) => {
        const db = await createDatabase(task, createStoreWithData)

        const tx = db.transaction("store", "readonly")
        const objectStore = tx.objectStore("store")
        const request = objectStore.openKeyCursor(
            IDBKeyRange.bound(4, 6),
            "prev",
        )

        const expected = [6, 5, 4]
        const actual: IDBValidKey[] = []

        let cursor = await requestToPromise(request)
        while (cursor) {
            expect(cursor.direction).toBe("prev")
            expect("value" in cursor).toBe(false)
            expect(idb.cmp(cursor.key, cursor.primaryKey)).toBe(0)
            actual.push(cursor.key)
            cursor.continue()
            cursor = await requestToPromise(request)
        }

        expect(actual).toEqual(expected)
    })

    test("invalid inputs", async ({ task }) => {
        const db = await createDatabase(task, createStoreWithData)

        const tx = db.transaction("store", "readonly")
        const objectStore = tx.objectStore("store")

        expect(() => {
            objectStore.openKeyCursor(NaN)
        }).toThrow(DataError)

        expect(() => {
            objectStore.openKeyCursor(new Date(NaN))
        }).toThrow(DataError)

        expect(() => {
            const cycle: unknown[] = []
            cycle.push(cycle)
            objectStore.openKeyCursor(cycle as IDBValidKey)
        }).toThrow(DataError)

        expect(() => {
            objectStore.openKeyCursor({} as IDBValidKey)
        }).toThrow(DataError)

        // Wait for transaction to become inactive
        await new Promise((resolve, reject) => {
            tx.oncomplete = resolve
            tx.onerror = () => reject(tx.error)
        })

        expect(() => {
            objectStore.openKeyCursor()
        }).toThrow(TransactionInactiveError)
    })
})
