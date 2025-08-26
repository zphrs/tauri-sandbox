import { describe, expect, test } from "vitest"
import { createDatabase, requestToPromise } from "../resources/createDatabase"
import { FDBKeyRange as IDBKeyRange } from "../../inMemoryIdb"

// Port of w3c test: idbcursor-direction-index-keyrange.any.js
// Tests IDBCursor direction with index and keyrange

interface TestRecord {
    name: string | number | string[]
}

const records = [1337, "Alice", "Bob", "Bob", "Greg", "Åke", ["Anne"]]

const cases = [
    {
        dir: "next" as IDBCursorDirection,
        expect: ["Alice:1", "Bob:2", "Bob:3", "Greg:4"],
    },
    {
        dir: "prev" as IDBCursorDirection,
        expect: ["Greg:4", "Bob:3", "Bob:2", "Alice:1"],
    },
    {
        dir: "nextunique" as IDBCursorDirection,
        expect: ["Alice:1", "Bob:2", "Greg:4"],
    },
    {
        dir: "prevunique" as IDBCursorDirection,
        expect: ["Greg:4", "Bob:2", "Alice:1"],
    },
]

function upgradeFunc(db: IDBDatabase) {
    const objStore = db.createObjectStore("test")
    objStore.createIndex("idx", "name")

    for (let i = 0; i < records.length; i++) {
        objStore.add({ name: records[i] }, i)
    }
}

describe("IDBCursor direction - index with keyrange", () => {
    cases.forEach((testcase) => {
        const { dir, expect: expectedResults } = testcase

        test(`IDBCursor direction - index with keyrange - ${dir}`, async ({
            task,
        }) => {
            const db = await createDatabase(task, upgradeFunc)

            const tx = db.transaction("test", "readonly")
            const store = tx.objectStore("test")
            const index = store.index("idx")
            const request = index.openCursor(IDBKeyRange.bound("AA", "ZZ"), dir)

            const results: string[] = []

            let cursor = await requestToPromise(request)
            while (cursor) {
                const value = cursor.value as TestRecord
                results.push(`${value.name}:${cursor.primaryKey}`)
                cursor.continue()
                cursor = await requestToPromise(request)
            }

            expect(results).toEqual(expectedResults)
        })
    })
})
