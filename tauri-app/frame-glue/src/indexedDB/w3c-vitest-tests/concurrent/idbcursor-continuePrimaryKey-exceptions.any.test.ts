import { describe, expect, test } from "vitest"
import { createDatabase, requestToPromise } from "../resources/createDatabase"

// Port of w3c test: idbcursor-continuePrimaryKey-exceptions.any.js
// Tests IDBCursor continuePrimaryKey() exception throwing

describe("IDBCursor continuePrimaryKey() exceptions", () => {
    test("IDBCursor continuePrimaryKey() on object store cursor", async ({
        task,
    }) => {
        const db = await createDatabase(task, (db) => {
            const store = db.createObjectStore("store")
            store.put("a", 1)
        })

        const tx = db.transaction("store", "readonly")
        const store = tx.objectStore("store")
        const request = store.openCursor()

        const cursor = await requestToPromise(request)
        expect(cursor).not.toBeNull()
        expect(cursor?.constructor.name).toBe("FDBCursorWithValue")

        expect(() => {
            cursor!.continuePrimaryKey(2, 2)
        }).toThrow()

        // Check that it throws InvalidAccessError specifically
        try {
            cursor!.continuePrimaryKey(2, 2)
            expect.unreachable("continuePrimaryKey() should throw")
        } catch (error) {
            expect((error as DOMException).name).toBe("InvalidAccessError")
        }
    })

    const testcases = [
        {
            direction: "nextunique" as IDBCursorDirection,
            expected_key: 1,
            expected_primaryKey: "a",
            continue_key: 2,
            continue_primaryKey: "a",
        },
        {
            direction: "prevunique" as IDBCursorDirection,
            expected_key: 3,
            expected_primaryKey: "a",
            continue_key: 2,
            continue_primaryKey: "a",
        },
    ]

    testcases.forEach((testcase) => {
        test(`IDBCursor continuePrimaryKey() on "${testcase.direction}" cursor`, async ({
            task,
        }) => {
            const db = await createDatabase(task, (db) => {
                const store = db.createObjectStore("store", { keyPath: "pk" })
                store.createIndex("index", "ik", {
                    multiEntry: true,
                })
                store.put({ pk: "a", ik: [1, 2, 3] })
                store.put({ pk: "b", ik: [1, 2, 3] })
            })

            const tx = db.transaction("store", "readonly")
            const store = tx.objectStore("store")
            const index = store.index("index")
            const request = index.openKeyCursor(null, testcase.direction)

            const cursor = await requestToPromise(request)
            expect(cursor).not.toBeNull()
            expect(cursor?.constructor.name).toBe("FDBCursor")
            expect(cursor?.direction).toBe(testcase.direction)
            expect(cursor?.key).toBe(testcase.expected_key)
            expect(cursor?.primaryKey).toBe(testcase.expected_primaryKey)

            expect(() => {
                cursor!.continuePrimaryKey(
                    testcase.continue_key,
                    testcase.continue_primaryKey,
                )
            }).toThrow()

            // Check that it throws InvalidAccessError specifically
            try {
                cursor!.continuePrimaryKey(
                    testcase.continue_key,
                    testcase.continue_primaryKey,
                )
                expect.unreachable("continuePrimaryKey() should throw")
            } catch (error) {
                expect((error as DOMException).name).toBe("InvalidAccessError")
            }
        })
    })
})
