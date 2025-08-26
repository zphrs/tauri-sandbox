import { describe, expect, test } from "vitest"
import { createDatabase, requestToPromise } from "../resources/createDatabase"
import { FDBKeyRange as IDBKeyRange } from "../../inMemoryIdb"
import { DataError } from "../../inMemoryIdb/lib/errors"

// Port of w3c test: idbobjectstore_getKey.any.js
// Tests IDBObjectStore.getKey() method functionality

describe("IDBObjectStore.getKey()", () => {
    // Helper function to create database with different store types
    async function createTestDatabase(task: { id?: string }) {
        return createDatabase(task, (db) => {
            const basic = db.createObjectStore("basic")
            const keyPathStore = db.createObjectStore("key path", {
                keyPath: "id",
            })
            const keyGeneratorStore = db.createObjectStore("key generator", {
                autoIncrement: true,
            })
            const keyGeneratorAndPathStore = db.createObjectStore(
                "key generator and key path",
                { autoIncrement: true, keyPath: "id" },
            )

            for (let i = 1; i <= 10; ++i) {
                basic.put(`value: ${i}`, i)
                keyPathStore.put({ id: i })
                keyGeneratorStore.put(`value: ${i}`)
                keyGeneratorAndPathStore.put({})
            }
        })
    }

    test("Invalid parameters", async ({ task }) => {
        const db = await createTestDatabase(task)

        const tx = db.transaction("basic", "readonly")
        const store = tx.objectStore("basic")

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect(() => (store as any).getKey()).toThrow(TypeError)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect(() => store.getKey(null as any)).toThrow(DataError)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect(() => store.getKey({} as any)).toThrow(DataError)
    })

    // Test all store types with key queries
    const storeNames = [
        "basic",
        "key path",
        "key generator",
        "key generator and key path",
    ]

    for (const storeName of storeNames) {
        test(`${storeName} - key`, async ({ task }) => {
            const db = await createTestDatabase(task)

            const tx = db.transaction(storeName)
            const store = tx.objectStore(storeName)
            const result = await requestToPromise(store.getKey(5))

            expect(result).toBe(5)
        })

        test(`${storeName} - range`, async ({ task }) => {
            const db = await createTestDatabase(task)

            const tx = db.transaction(storeName)
            const store = tx.objectStore(storeName)
            const result = await requestToPromise(
                store.getKey(IDBKeyRange.lowerBound(4.5)),
            )

            expect(result).toBe(5)
        })

        test(`${storeName} - key - no match`, async ({ task }) => {
            const db = await createTestDatabase(task)

            const tx = db.transaction(storeName)
            const store = tx.objectStore(storeName)
            const result = await requestToPromise(store.getKey(11))

            expect(result).toBe(undefined)
        })

        test(`${storeName} - range - no match`, async ({ task }) => {
            const db = await createTestDatabase(task)

            const tx = db.transaction(storeName)
            const store = tx.objectStore(storeName)
            const result = await requestToPromise(
                store.getKey(IDBKeyRange.lowerBound(11)),
            )

            expect(result).toBe(undefined)
        })
    }
})
