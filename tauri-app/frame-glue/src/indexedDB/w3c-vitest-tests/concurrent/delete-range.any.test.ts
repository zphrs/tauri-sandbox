import { test, expect } from "vitest"
import { createDatabase, requestToPromise } from "../resources/createDatabase"
import { FDBKeyRange as IDBKeyRange } from "../../inMemoryIdb"

// Port of w3c test: delete-range.any.js
// Tests deleting ranges of keys from an object store using IDBKeyRange.bound()

interface RangeTestEntry {
    lower: number
    upper: number
    lowerOpen: boolean
    upperOpen: boolean
    expected: number[]
}

const transactionCounts = [1, 2]

const entries: RangeTestEntry[] = [
    {
        lower: 3,
        upper: 8,
        lowerOpen: false,
        upperOpen: false,
        expected: [1, 2, 9, 10],
    },
    {
        lower: 3,
        upper: 8,
        lowerOpen: true,
        upperOpen: false,
        expected: [1, 2, 3, 9, 10],
    },
    {
        lower: 3,
        upper: 8,
        lowerOpen: false,
        upperOpen: true,
        expected: [1, 2, 8, 9, 10],
    },
    {
        lower: 3,
        upper: 8,
        lowerOpen: true,
        upperOpen: true,
        expected: [1, 2, 3, 8, 9, 10],
    },
]

const testCases = transactionCounts.flatMap((txCount) =>
    entries.map((entry) => ({
        txCount,
        ...entry,
        description: `Delete range [${entry.lower}, ${entry.upper}] with ${txCount} transaction and lowerOpen=${entry.lowerOpen}, upperOpen=${entry.upperOpen}`,
    })),
)

test.for(testCases)(
    "$description",
    async (
        { txCount, lower, upper, lowerOpen, upperOpen, expected },
        { task },
    ) => {
        const db = await createDatabase(task, (db) => {
            db.createObjectStore("store")
        })

        let store = db.transaction("store", "readwrite").objectStore("store")

        // Add values 1-10 to the store
        for (let i = 1; i <= 10; ++i) {
            await requestToPromise(store.put(i, i))
        }

        // Delete the range
        await requestToPromise(
            store.delete(IDBKeyRange.bound(lower, upper, lowerOpen, upperOpen)),
        )

        if (txCount === 2) {
            store = db.transaction("store", "readonly").objectStore("store")
        }

        // Read back all remaining keys
        const keys: number[] = []
        const cursor_request = store.openCursor()
        let count = 0
        await new Promise<void>((resolve, reject) => {
            cursor_request.onsuccess = () => {
                const cursor = cursor_request.result
                if (cursor) {
                    keys.push(cursor.key as number)
                    cursor.continue()
                    if (count++ > 10) reject(new Error("too many loops"))
                } else {
                    resolve()
                }
            }
            cursor_request.onerror = () => {
                reject(new Error("Failed to open cursor for read request"))
            }
        })

        expect(keys).toEqual(expected)
    },
)
