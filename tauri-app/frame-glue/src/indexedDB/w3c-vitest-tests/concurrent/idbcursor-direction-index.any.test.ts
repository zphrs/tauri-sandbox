import { describe, test, expect } from "vitest"
import { createDatabase, requestToPromise } from "../resources/createDatabase"

// Port of w3c test: idbcursor-direction-index.any.js
// Tests IDBCursor direction for index cursors

const records = ["Alice", "Bob", "Bob", "Greg"]

const cases = [
    {
        dir: "next" as IDBCursorDirection,
        expect: ["Alice:0", "Bob:1", "Bob:2", "Greg:3"],
    },
    {
        dir: "prev" as IDBCursorDirection,
        expect: ["Greg:3", "Bob:2", "Bob:1", "Alice:0"],
    },
    {
        dir: "nextunique" as IDBCursorDirection,
        expect: ["Alice:0", "Bob:1", "Greg:3"],
    },
    {
        dir: "prevunique" as IDBCursorDirection,
        expect: ["Greg:3", "Bob:1", "Alice:0"],
    },
]

describe("IDBCursor direction - index", () => {
    for (const testcase of cases) {
        const { dir, expect: expectedResults } = testcase

        test(`IDBCursor direction - index - ${dir}`, async ({ task }) => {
            const db = await createDatabase(task, (db) => {
                const objStore = db.createObjectStore("test")
                objStore.createIndex("idx", "name")

                for (let i = 0; i < records.length; i++) {
                    objStore.add({ name: records[i] }, i)
                }
            })

            const tx = db.transaction("test", "readonly")
            const store = tx.objectStore("test")
            const index = store.index("idx")
            const request = index.openCursor(undefined, dir)

            const results: string[] = []
            let cursor = await requestToPromise(request)

            while (cursor) {
                const value = cursor.value.name + ":" + cursor.primaryKey
                results.push(value)
                cursor.continue()
                cursor = await requestToPromise(request)
            }

            expect(results).toEqual(expectedResults)
            expect(results.length).toBe(expectedResults.length)
        })
    }
})
