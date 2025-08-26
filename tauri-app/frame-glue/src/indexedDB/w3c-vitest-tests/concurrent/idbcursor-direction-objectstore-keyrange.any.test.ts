import { describe, test, expect } from "vitest"
import { createDatabase } from "../resources/createDatabase"
import { FDBKeyRange as IDBKeyRange } from "../../inMemoryIdb"

// Port of w3c test: idbcursor-direction-objectstore-keyrange.any.js
// Tests IDBCursor direction - object store with keyrange

const records = [1337, "Alice", "Bob", "Greg", "Åke", ["Anne"]]

const cases = [
    { dir: "next" as IDBCursorDirection, expect: ["Alice", "Bob", "Greg"] },
    { dir: "prev" as IDBCursorDirection, expect: ["Greg", "Bob", "Alice"] },
    {
        dir: "nextunique" as IDBCursorDirection,
        expect: ["Alice", "Bob", "Greg"],
    },
    {
        dir: "prevunique" as IDBCursorDirection,
        expect: ["Greg", "Bob", "Alice"],
    },
]

function upgradeFunc(db: IDBDatabase) {
    const objStore = db.createObjectStore("test")
    for (let i = 0; i < records.length; i++) {
        objStore.add(records[i], records[i])
    }
}

describe("IDBCursor direction - object store with keyrange", () => {
    cases.forEach((testcase) => {
        const { dir, expect: expectedValues } = testcase

        test(`IDBCursor direction - object store with keyrange - ${dir}`, async ({
            task,
        }) => {
            const db = await createDatabase(task, upgradeFunc)

            const tx = db.transaction("test", "readonly")
            const objStore = tx.objectStore("test")
            const request = objStore.openCursor(
                IDBKeyRange.bound("AA", "ZZ"),
                dir,
            )

            const actualValues: unknown[] = []

            return new Promise<void>((resolve, reject) => {
                request.onsuccess = (e) => {
                    const cursor = (e.target as IDBRequest<IDBCursorWithValue>)
                        .result
                    if (!cursor) {
                        try {
                            expect(actualValues.length).toBe(
                                expectedValues.length,
                            )
                            expect(actualValues).toEqual(expectedValues)
                            resolve()
                        } catch (error) {
                            reject(error)
                        }
                        return
                    }
                    actualValues.push(cursor.value)
                    cursor.continue()
                }

                request.onerror = (e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    reject(
                        new Error(
                            `Request error: ${
                                (e.target as IDBRequest).error?.message
                            }`,
                        ),
                    )
                }
            })
        })
    })
})
