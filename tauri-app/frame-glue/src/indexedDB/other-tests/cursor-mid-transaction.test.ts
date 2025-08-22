import { test, expect, describe } from "vitest"
import {
    createDatabase,
    requestToPromise,
} from "../w3c-vitest-tests/resources/createDatabase"

describe("cross-threaded cursor iteration", () => {
    // 1: create object store with an index on ""
    // 2: write A at key 2, C at key 1
    // 3: commit transaction
    // 4: open new readwrite transaction
    // 5: write B at key 0
    // 6: read all keys from index
    // 7: make sure it matches [{key: 2, value: A}, {key: 0, value: B}, {key: 1, value: C}]
    test("cursor iteration split between fetched and cached", async ({
        task,
    }) => {
        const db = await createDatabase(task, (db) => {
            const store = db.createObjectStore("test")
            store.createIndex("index", "")

            store.add("C", 1)
            store.add("A", 2)
        })

        const expected = [
            { key: 2, value: "A" },
            { key: 0, value: "B" },
            { key: 1, value: "C" },
        ]
        const tx = db.transaction("test", "readwrite")
        const store = tx.objectStore("test")
        await requestToPromise(store.add("B", 0))
        const cursorRequest = store.index("index").openCursor()

        for (const { key, value } of expected) {
            const cursor = await requestToPromise(cursorRequest)
            expect(cursor?.value).toBe(value)
            expect(cursor?.primaryKey).toBe(key)
            cursor?.continue()
        }
    })

    // 1: create object store with an index on ""
    // 2: write A at key 2, B at key 1
    // 3: commit transaction
    // 4: open new readwrite transaction
    // 5: write A at key 0
    // 6: read all keys from index
    // 7: make sure it matches [{key: 2, value: A}, {key: 0, value: A}, {key: 1, value: B}]
    test("cursor iteration split between fetched and cached", async ({
        task,
    }) => {
        const db = await createDatabase(task, (db) => {
            const store = db.createObjectStore("test")
            store.createIndex("index", "")

            store.add("A", 2)
            store.add("B", 1)
        })

        const expected = [
            { key: 0, value: "A" },
            { key: 2, value: "A" },
            { key: 1, value: "B" },
        ]
        const tx = db.transaction("test", "readwrite")
        const store = tx.objectStore("test")
        await requestToPromise(store.add("A", 0))
        const cursorRequest = store.index("index").openCursor()

        for (const { key, value } of expected) {
            const cursor = await requestToPromise(cursorRequest)
            expect(cursor?.value).toBe(value)
            expect(cursor?.primaryKey).toBe(key)
            cursor?.continue()
        }
    })
})
