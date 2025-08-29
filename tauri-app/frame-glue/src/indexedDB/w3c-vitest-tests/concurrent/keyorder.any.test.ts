import { describe, expect, test } from "vitest"
import { createDatabase, idb } from "../resources/createDatabase"

// Port of w3c test: keyorder.any.js
// Tests key sort order

describe("keyorder", () => {
    const keysort = (
        desc: string,
        unsorted: IDBValidKey[],
        expected: IDBValidKey[],
    ) => {
        test(`Database readback sort - ${desc}`, async ({ task }) => {
            const storeName = `store-${Date.now()}-${Math.random()}`

            const db = await createDatabase(task, (db) => {
                const objStore = db.createObjectStore(storeName)

                for (let i = 0; i < unsorted.length; i++) {
                    objStore.add("value", unsorted[i])
                }
            })

            const actualKeys: IDBValidKey[] = []
            const tx = db.transaction(storeName)
            const store = tx.objectStore(storeName)
            const request = store.openCursor()

            await new Promise<void>((resolve, reject) => {
                request.onsuccess = () => {
                    try {
                        const cursor = request.result

                        if (cursor) {
                            actualKeys.push(cursor.key)
                            cursor.continue()
                        } else {
                            expect(actualKeys).toEqual(expected)
                            expect(actualKeys.length).toBe(expected.length)
                            resolve()
                        }
                    } catch (error) {
                        reject(error)
                    }
                }
                request.onerror = () => reject(request.error)
            })
        })

        test(`IDBKey.cmp sort - ${desc}`, () => {
            const sorted = unsorted.slice(0).sort((a, b) => idb.cmp(a, b))
            expect(sorted).toEqual(expected)
        })
    }

    const now = new Date()
    const oneSecAgo = new Date(now.getTime() - 1000)
    const oneMinFuture = new Date(now.getTime() + 1000 * 60)

    keysort("String < Array", [[0], "yo", "", []], ["", "yo", [], [0]])

    keysort(
        "float < String",
        [Infinity, "yo", 0, "", 100],
        [0, 100, Infinity, "", "yo"],
    )

    keysort(
        "float < Date",
        [now, 0, 9999999999999, -0.22],
        [-0.22, 0, 9999999999999, now],
    )

    keysort(
        "float < Date < String < Array",
        [[], "", now, [0], "-1", 0, 9999999999999],
        [0, 9999999999999, now, "", "-1", [], [0]],
    )

    keysort(
        "Date(1 sec ago) < Date(now) < Date(1 minute in future)",
        [now, oneSecAgo, oneMinFuture],
        [oneSecAgo, now, oneMinFuture],
    )

    keysort(
        "-1.1 < 1 < 1.01337 < 1.013373 < 2",
        [1.013373, 2, 1.01337, -1.1, 1],
        [-1.1, 1, 1.01337, 1.013373, 2],
    )

    keysort(
        "-Infinity < -0.01 < 0 < Infinity",
        [0, -0.01, -Infinity, Infinity],
        [-Infinity, -0.01, 0, Infinity],
    )

    keysort(
        '"" < "a" < "ab" < "b" < "ba"',
        ["a", "ba", "", "b", "ab"],
        ["", "a", "ab", "b", "ba"],
    )

    keysort(
        "Arrays",
        [[[0]], [0], [], [0, 0], [0, [0]]],
        [[], [0], [0, 0], [0, [0]], [[0]]],
    )

    const bigArray: number[] = []
    const biggerArray: number[] = []
    for (let i = 0; i < 10000; i++) {
        bigArray.push(i)
        biggerArray.push(i)
    }
    biggerArray.push(0)

    keysort(
        "Array.length: 10,000 < Array.length: 10,001",
        [biggerArray, [0, 2, 3], [0], [9], bigArray],
        [[0], bigArray, biggerArray, [0, 2, 3], [9]],
    )

    keysort(
        "Infinity inside arrays",
        [
            [Infinity, 1],
            [Infinity, Infinity],
            [1, 1],
            [1, Infinity],
            [1, -Infinity],
            [-Infinity, Infinity],
        ],
        [
            [-Infinity, Infinity],
            [1, -Infinity],
            [1, 1],
            [1, Infinity],
            [Infinity, 1],
            [Infinity, Infinity],
        ],
    )

    keysort(
        "Test different stuff at once",
        [
            now,
            [0, []],
            "test",
            1,
            ["a", [1, [-1]]],
            ["b", "a"],
            [0, 2, "c"],
            ["a", [1, 2]],
            [],
            [0, [], 3],
            ["a", "b"],
            [1, 2],
            ["a", "b", "c"],
            oneSecAgo,
            [0, "b", "c"],
            Infinity,
            -Infinity,
            2.55,
            [0, now],
            [1],
        ],
        [
            -Infinity,
            1,
            2.55,
            Infinity,
            oneSecAgo,
            now,
            "test",
            [],
            [0, 2, "c"],
            [0, now],
            [0, "b", "c"],
            [0, []],
            [0, [], 3],
            [1],
            [1, 2],
            ["a", "b"],
            ["a", "b", "c"],
            ["a", [1, 2]],
            ["a", [1, [-1]]],
            ["b", "a"],
        ],
    )
})
