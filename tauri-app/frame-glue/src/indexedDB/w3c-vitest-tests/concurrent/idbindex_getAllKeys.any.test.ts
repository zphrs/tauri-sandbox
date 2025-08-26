import { describe, test, expect } from "vitest"
import { createDatabase, requestToPromise } from "../resources/createDatabase"
import { FDBKeyRange as IDBKeyRange } from "../../inMemoryIdb"
import { DataError } from "../../inMemoryIdb/lib/errors"

// Port of w3c test: idbindex_getAllKeys.any.js
// Tests IDBIndex.getAllKeys() method functionality

// Define constants used to populate object stores and indexes
const alphabet = "abcdefghijklmnopqrstuvwxyz".split("")

// Test data structures
interface TestRecord {
    key: IDBValidKey
    primaryKey: IDBValidKey
    value: unknown
}

// Setup function for index getAllKeys tests
async function setupIndex(
    task: { id?: string },
    storeName: string,
): Promise<{ db: IDBDatabase; expectedRecords: TestRecord[] }> {
    const expectedRecords: TestRecord[] = []

    const db = await createDatabase(task, (db) => {
        switch (storeName) {
            case "generated": {
                // Create an object store with auto-incrementing, inline keys
                // Create an index on the uppercase letter property `upper`
                const store = db.createObjectStore(storeName, {
                    autoIncrement: true,
                    keyPath: "id",
                })
                store.createIndex("test_idx", "upper")
                alphabet.forEach((letter) => {
                    const value = {
                        ch: letter,
                        upper: letter.toUpperCase(),
                    }
                    store.put(value)

                    const generatedKey = alphabet.indexOf(letter) + 1
                    expectedRecords.push({
                        key: value.upper,
                        primaryKey: generatedKey,
                        value,
                    })
                })
                break
            }
            case "out-of-line": {
                // Create an object store with out-of-line keys
                // Create an index on the uppercase letter property `upper`
                const store = db.createObjectStore(storeName)
                store.createIndex("test_idx", "upper")
                alphabet.forEach((letter) => {
                    const value = {
                        ch: letter,
                        upper: letter.toUpperCase(),
                    }
                    store.put(value, letter)

                    expectedRecords.push({
                        key: value.upper,
                        primaryKey: letter,
                        value,
                    })
                })
                break
            }
            case "out-of-line-not-unique": {
                // Create an index on the `half` property, which is not unique
                const store = db.createObjectStore(storeName)
                store.createIndex("test_idx", "half")
                alphabet.forEach((letter) => {
                    let half = "first"
                    if (letter > "m") {
                        half = "second"
                    }

                    const value = { ch: letter, half }
                    store.put(value, letter)

                    expectedRecords.push({
                        key: half,
                        primaryKey: letter,
                        value,
                    })
                })
                break
            }
            case "out-of-line-multi": {
                // Create a multi-entry index on `attribs`, which is an array of strings
                const store = db.createObjectStore(storeName)
                store.createIndex("test_idx", "attribs", {
                    multiEntry: true,
                })
                alphabet.forEach((letter) => {
                    const attrs: string[] = []
                    if (["a", "e", "i", "o", "u"].indexOf(letter) !== -1) {
                        attrs.push("vowel")
                    } else {
                        attrs.push("consonant")
                    }
                    if (letter === "a") {
                        attrs.push("first")
                    }
                    if (letter === "z") {
                        attrs.push("last")
                    }
                    const value = { ch: letter, attribs: attrs }
                    store.put(value, letter)

                    // For multi-entry indexes, each value appears once per key it contains
                    for (const attr of attrs) {
                        expectedRecords.push({
                            key: attr,
                            primaryKey: letter,
                            value,
                        })
                    }
                })
                break
            }
            case "empty": {
                // Create an empty index
                const store = db.createObjectStore(storeName)
                store.createIndex("test_idx", "upper")
                break
            }
            default:
                throw new Error(`Unknown storeName: ${storeName}`)
        }
    })

    return { db, expectedRecords }
}

// Calculate expected results for getAllKeys
function calculateExpectedGetAllKeysResults(
    records: TestRecord[],
    query?: IDBValidKey | IDBKeyRange,
    count?: number,
): IDBValidKey[] {
    let filteredRecords = [...records]

    // Remove records that don't satisfy the query
    if (query !== undefined) {
        let keyRange = query
        if (!(keyRange instanceof IDBKeyRange)) {
            // Create an IDBKeyRange for the query's key value
            keyRange = IDBKeyRange.only(query as IDBValidKey)
        }
        filteredRecords = filteredRecords.filter((record) =>
            keyRange.includes(record.key),
        )
    }

    // Sort records by key, then by primaryKey
    filteredRecords.sort((a, b) => {
        const keyCompare = indexedDB.cmp(a.key, b.key)
        if (keyCompare !== 0) return keyCompare
        return indexedDB.cmp(a.primaryKey, b.primaryKey)
    })

    // Deduplicate primary keys - this is important for multi-entry indexes
    // We need to preserve only the first occurrence of each primary key
    const seenPrimaryKeys: IDBValidKey[] = []
    const uniqueRecords = filteredRecords.filter((record) => {
        const isDuplicate = seenPrimaryKeys.some(
            (seenKey) => indexedDB.cmp(seenKey, record.primaryKey) === 0,
        )
        if (!isDuplicate) {
            seenPrimaryKeys.push(record.primaryKey)
            return true
        }
        return false
    })

    // Apply count limit
    let finalRecords = uniqueRecords
    if (count !== undefined && count !== 0) {
        finalRecords = uniqueRecords.slice(0, count)
    }

    // Return only the primary keys (which is what getAllKeys returns)
    return finalRecords.map((record) => record.primaryKey)
}

// Main test function for index getAllKeys
async function indexGetAllKeysTest(
    task: { id?: string },
    storeName: string,
    options?: { query?: IDBValidKey | IDBKeyRange; count?: number },
): Promise<void> {
    const { db, expectedRecords } = await setupIndex(task, storeName)

    const tx = db.transaction(storeName, "readonly")
    const store = tx.objectStore(storeName)
    const queryTarget = store.index("test_idx")

    let request: IDBRequest<IDBValidKey[]>

    if (options?.query !== undefined && options?.count !== undefined) {
        request = queryTarget.getAllKeys(options.query, options.count)
    } else if (options?.query !== undefined) {
        request = queryTarget.getAllKeys(options.query)
    } else if (options?.count !== undefined) {
        request = queryTarget.getAllKeys(undefined, options.count)
    } else {
        request = queryTarget.getAllKeys()
    }

    const actualResults = await requestToPromise(request)
    const expectedResults = calculateExpectedGetAllKeysResults(
        expectedRecords,
        options?.query,
        options?.count,
    )

    expect(actualResults).toEqual(expectedResults)
}

// Test for getAllKeys with invalid keys
async function getAllKeysWithInvalidKeysTest(
    task: { id?: string },
    storeName: string,
): Promise<void> {
    const { db } = await setupIndex(task, storeName)

    const tx = db.transaction(storeName, "readonly")
    const store = tx.objectStore(storeName)
    const queryTarget = store.index("test_idx")

    const invalidKeys = [
        {
            description: "Date(NaN)",
            value: new Date(NaN),
        },
        {
            description: "Array",
            value: [{}],
        },
    ]

    for (const { value } of invalidKeys) {
        expect(() => {
            queryTarget.getAllKeys(value as IDBValidKey)
        }).toThrow(DataError)
    }
}

describe("IDBIndex.getAllKeys()", () => {
    test("Single item get", async ({ task }) => {
        await indexGetAllKeysTest(task, "out-of-line", { query: "C" })
    })

    test("Empty object store", async ({ task }) => {
        await indexGetAllKeysTest(task, "empty")
    })

    test("Get all keys", async ({ task }) => {
        await indexGetAllKeysTest(task, "out-of-line")
    })

    test("Get all generated keys", async ({ task }) => {
        await indexGetAllKeysTest(task, "generated")
    })

    test("maxCount=10", async ({ task }) => {
        await indexGetAllKeysTest(task, "out-of-line", { count: 10 })
    })

    test("Get bound range", async ({ task }) => {
        await indexGetAllKeysTest(task, "out-of-line", {
            query: IDBKeyRange.bound("G", "M"),
        })
    })

    test("Get bound range with maxCount", async ({ task }) => {
        await indexGetAllKeysTest(task, "out-of-line", {
            query: IDBKeyRange.bound("G", "M"),
            count: 3,
        })
    })

    test("Get upper excluded", async ({ task }) => {
        await indexGetAllKeysTest(task, "out-of-line", {
            query: IDBKeyRange.bound(
                "G",
                "K",
                /*lowerOpen=*/ false,
                /*upperOpen=*/ true,
            ),
        })
    })

    test("Get lower excluded", async ({ task }) => {
        await indexGetAllKeysTest(task, "out-of-line", {
            query: IDBKeyRange.bound(
                "G",
                "K",
                /*lowerOpen=*/ true,
                /*upperOpen=*/ false,
            ),
        })
    })

    test("Get bound range (generated) with maxCount", async ({ task }) => {
        await indexGetAllKeysTest(task, "generated", {
            query: IDBKeyRange.bound(4, 15),
            count: 3,
        })
    })

    test("Non existent key", async ({ task }) => {
        await indexGetAllKeysTest(task, "out-of-line", {
            query: "Doesn't exist",
        })
    })

    test("maxCount=0", async ({ task }) => {
        await indexGetAllKeysTest(task, "out-of-line", { count: 0 })
    })

    test("Max value count", async ({ task }) => {
        await indexGetAllKeysTest(task, "out-of-line", {
            count: 4294967295,
        })
    })

    test("Query with empty range where first key < upperBound", async ({
        task,
    }) => {
        await indexGetAllKeysTest(task, "out-of-line", {
            query: IDBKeyRange.upperBound("0"),
        })
    })

    test("Query with empty range where lowerBound < last key", async ({
        task,
    }) => {
        await indexGetAllKeysTest(task, "out-of-line", {
            query: IDBKeyRange.lowerBound("ZZ"),
        })
    })

    test("Retrieve multiEntry key", async ({ task }) => {
        await indexGetAllKeysTest(task, "out-of-line-not-unique", {
            query: "first",
        })
    })

    test("Retrieve one key multiple values", async ({ task }) => {
        const storeName = "out-of-line-multi"
        const options = {
            query: "vowel",
        }

        const { db } = await setupIndex(task, storeName)

        const tx = db.transaction(storeName, "readonly")
        const store = tx.objectStore(storeName)
        const queryTarget = store.index("test_idx")

        const results = await requestToPromise(
            queryTarget.getAllKeys(options.query),
        )

        expect(results).toMatchInlineSnapshot(`
          [
            "a",
            "a",
            "e",
            "i",
            "o",
            "u",
          ]
        `)
    })

    test("Get all keys with invalid query keys", async ({ task }) => {
        await getAllKeysWithInvalidKeysTest(task, "out-of-line")
    })
})
