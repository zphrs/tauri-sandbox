import { describe, test, expect } from "vitest"
import { createDatabase, requestToPromise } from "../resources/createDatabase"
import { FDBKeyRange as IDBKeyRange } from "../../inMemoryIdb"

// Port of w3c test: idbindex_getAll.any.js
// Tests IDBIndex.getAll() method functionality

const wrapThreshold = 128 * 1024

// Define constants used to populate object stores and indexes
const alphabet = "abcdefghijklmnopqrstuvwxyz".split("")

// Generate large values for testing
function largeValue(size: number, seed: number): Uint8Array {
    const buffer = new Uint8Array(size)
    // Fill with a lot of the same byte
    if (seed === 0) {
        buffer.fill(0x11, 0, size - 1)
        return buffer
    }

    // 32-bit xorshift - the seed can't be zero
    let state = 1000 + seed

    for (let i = 0; i < size; ++i) {
        state ^= state << 13
        state ^= state >> 17
        state ^= state << 5
        buffer[i] = state & 0xff
    }

    return buffer
}

// Test data structures
interface TestRecord {
    key: IDBValidKey
    primaryKey: IDBValidKey
    value: unknown
}

// Setup function for index getAll tests
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
                alphabet.forEach((letter, idx) => {
                    const value = {
                        ch: letter,
                        id: idx,
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
            case "large-values": {
                // Create an object store and index with 3 large values and their seed
                const store = db.createObjectStore("large-values")
                store.createIndex("test_idx", "seed")
                for (let i = 0; i < 3; i++) {
                    const seed = i
                    const randomValue = largeValue(wrapThreshold, seed)
                    const recordValue = { seed, randomValue }
                    store.put(recordValue, i)

                    expectedRecords.push({
                        key: seed,
                        primaryKey: i,
                        value: recordValue,
                    })
                }
                break
            }
            default:
                throw new Error(`Unknown storeName: ${storeName}`)
        }
    })

    return { db, expectedRecords }
}

// Calculate expected results for getAll
function calculateExpectedGetAllResults(
    records: TestRecord[],
    query?: IDBValidKey | IDBKeyRange,
    count?: number,
): unknown[] {
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

    // Limit the number of records
    if (count) {
        filteredRecords = filteredRecords.slice(0, count)
    }

    // Note: This matches the current implementation behavior where multi-entry
    // indexes can return duplicate values
    return filteredRecords.map(({ value }) => value)
}

// Assert IDB values array equals expected values
function assertIdbValuesEquals(
    actualValues: unknown[],
    expectedValues: unknown[],
): void {
    expect(actualValues).toEqual(expectedValues)
}

// Main test function for index getAll
async function indexGetAllValuesTest(
    task: { id?: string },
    storeName: string,
    query?: IDBValidKey | IDBKeyRange,
    count?: number,
): Promise<void> {
    const { db, expectedRecords } = await setupIndex(task, storeName)

    const transaction = db.transaction(storeName, "readonly")
    const queryTarget = transaction.objectStore(storeName).index("test_idx")

    // Use the standard getAll API with optional arguments
    let request: IDBRequest
    if (query !== undefined && count !== undefined) {
        request = queryTarget.getAll(query, count)
    } else if (query !== undefined) {
        request = queryTarget.getAll(query)
    } else if (count !== undefined) {
        request = queryTarget.getAll(undefined, count)
    } else {
        request = queryTarget.getAll()
    }

    const actualResults = await requestToPromise(request)
    const expectedResults = calculateExpectedGetAllResults(
        expectedRecords,
        query,
        count,
    )

    assertIdbValuesEquals(actualResults, expectedResults)
}

// Test for getAll with invalid keys
async function getAllWithInvalidKeysTest(
    task: { id?: string },
    storeName: string,
): Promise<void> {
    const { db } = await setupIndex(task, storeName)

    const transaction = db.transaction(storeName, "readonly")
    const queryTarget = transaction.objectStore(storeName).index("test_idx")

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

    invalidKeys.forEach(({ value }) => {
        expect(() => {
            queryTarget.getAll(value as IDBValidKey)
        }).toThrow()
    })
}

describe("IDBIndex.getAll()", () => {
    test("Single item get", async ({ task }) => {
        await indexGetAllValuesTest(task, "out-of-line", "C")
    })

    test("Empty object store", async ({ task }) => {
        await indexGetAllValuesTest(task, "empty")
    })

    test("Get all", async ({ task }) => {
        await indexGetAllValuesTest(task, "out-of-line")
    })

    test("Get all with generated keys", async ({ task }) => {
        await indexGetAllValuesTest(task, "generated")
    })

    test("Get all with large values", async ({ task }) => {
        await indexGetAllValuesTest(task, "large-values")
    })

    test("maxCount=10", async ({ task }) => {
        await indexGetAllValuesTest(task, "out-of-line", undefined, 10)
    })

    test("Get bound range", async ({ task }) => {
        await indexGetAllValuesTest(
            task,
            "out-of-line",
            IDBKeyRange.bound("G", "M"),
        )
    })

    test("Get bound range with maxCount", async ({ task }) => {
        await indexGetAllValuesTest(
            task,
            "out-of-line",
            IDBKeyRange.bound("G", "M"),
            3,
        )
    })

    test("Get upper excluded", async ({ task }) => {
        await indexGetAllValuesTest(
            task,
            "out-of-line",
            IDBKeyRange.bound(
                "G",
                "K",
                /*lowerOpen=*/ false,
                /*upperOpen=*/ true,
            ),
        )
    })

    test("Get lower excluded", async ({ task }) => {
        await indexGetAllValuesTest(
            task,
            "out-of-line",
            IDBKeyRange.bound(
                "G",
                "K",
                /*lowerOpen=*/ true,
                /*upperOpen=*/ false,
            ),
        )
    })

    test("Get bound range (generated) with maxCount", async ({ task }) => {
        await indexGetAllValuesTest(
            task,
            "generated",
            IDBKeyRange.bound(4, 15),
            3,
        )
    })

    test("Non existent key", async ({ task }) => {
        await indexGetAllValuesTest(task, "out-of-line", "Doesn't exist")
    })

    test("maxCount=0", async ({ task }) => {
        await indexGetAllValuesTest(task, "out-of-line", undefined, 0)
    })

    test("Max value count", async ({ task }) => {
        await indexGetAllValuesTest(task, "out-of-line", undefined, 4294967295)
    })

    test("Query with empty range where first key < upperBound", async ({
        task,
    }) => {
        await indexGetAllValuesTest(
            task,
            "out-of-line",
            IDBKeyRange.upperBound("0"),
        )
    })

    test("Query with empty range where lowerBound < last key", async ({
        task,
    }) => {
        await indexGetAllValuesTest(
            task,
            "out-of-line",
            IDBKeyRange.lowerBound("ZZ"),
        )
    })

    test("Retrieve multiEntry key", async ({ task }) => {
        await indexGetAllValuesTest(task, "out-of-line-not-unique", "first")
    })

    test("Retrieve one key multiple values", async ({ task, expect }) => {
        const storeName = "out-of-line-multi"
        const query = "vowel"
        const { db } = await setupIndex(task, storeName)

        const transaction = db.transaction(storeName, "readonly")
        const queryTarget = transaction.objectStore(storeName).index("test_idx")

        // Use the standard getAll API with optional arguments
        const request = queryTarget.getAll(query)

        const actualResults = await requestToPromise(request)
        expect(actualResults).toMatchInlineSnapshot(`
          [
            {
              "attribs": [
                "vowel",
                "first",
              ],
              "ch": "a",
            },
            {
              "attribs": [
                "vowel",
                "first",
              ],
              "ch": "a",
            },
            {
              "attribs": [
                "vowel",
              ],
              "ch": "e",
            },
            {
              "attribs": [
                "vowel",
              ],
              "ch": "i",
            },
            {
              "attribs": [
                "vowel",
              ],
              "ch": "o",
            },
            {
              "attribs": [
                "vowel",
              ],
              "ch": "u",
            },
          ]
        `)
    })

    test("Get all values with invalid query keys", async ({ task }) => {
        await getAllWithInvalidKeysTest(task, "out-of-line")
    })
})
