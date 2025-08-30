import { describe, expect, test } from "vitest"
import { createDatabase } from "../resources/createDatabase"

// Port of w3c test: list_ordering.any.js
// Tests ObjectStoreNames and indexNames ordering

function listOrderTest(
    description: string,
    unsorted: Array<string | number>,
    expected: string[],
) {
    test(`Validate ObjectStoreNames and indexNames list order - ${description}`, async ({
        task,
    }) => {
        let lastObjStore: IDBObjectStore
        let lastObjStoreName: string

        const db = await createDatabase(task, (database) => {
            // Create object stores in unsorted order
            for (let i = 0; i < unsorted.length; i++) {
                lastObjStore = database.createObjectStore(String(unsorted[i]))
                lastObjStoreName = String(unsorted[i])
            }

            // Check objectStoreNames ordering during upgrade
            expect(database.objectStoreNames.length).toBe(expected.length)
            for (let i = 0; i < expected.length; i++) {
                expect(database.objectStoreNames[i]).toBe(expected[i])
            }

            // Create indexes in unsorted order on the last object store
            for (let i = 0; i < unsorted.length; i++) {
                lastObjStore.createIndex(String(unsorted[i]), "length")
            }

            // Check indexNames ordering during upgrade
            expect(lastObjStore.indexNames.length).toBe(expected.length)
            for (let i = 0; i < expected.length; i++) {
                expect(lastObjStore.indexNames[i]).toBe(expected[i])
            }
        })

        // Check objectStoreNames ordering after database is opened
        expect(db.objectStoreNames.length).toBe(expected.length)
        for (let i = 0; i < expected.length; i++) {
            expect(db.objectStoreNames[i]).toBe(expected[i])
        }

        // Get the last object store to check indexNames
        const tx = db.transaction(lastObjStoreName!, "readonly")
        const store = tx.objectStore(lastObjStoreName!)

        // Check indexNames ordering after database is opened
        expect(store.indexNames.length).toBe(expected.length)
        for (let i = 0; i < expected.length; i++) {
            expect(store.indexNames[i]).toBe(expected[i])
        }
    })
}

describe("list_ordering", () => {
    listOrderTest(
        "numbers",
        [123456, -12345, -123, 123, 1234, -1234, 0, 12345, -123456],
        [
            "-123",
            "-1234",
            "-12345",
            "-123456",
            "0",
            "123",
            "1234",
            "12345",
            "123456",
        ],
    )

    listOrderTest(
        "numbers 'overflow'",
        [9, 1, 1000000000, 200000000000000000],
        ["1", "1000000000", "200000000000000000", "9"],
    )

    listOrderTest(
        "lexigraphical string sort",
        ["cc", "c", "aa", "a", "bb", "b", "ab", "", "ac"],
        ["", "a", "aa", "ab", "ac", "b", "bb", "c", "cc"],
    )
})
