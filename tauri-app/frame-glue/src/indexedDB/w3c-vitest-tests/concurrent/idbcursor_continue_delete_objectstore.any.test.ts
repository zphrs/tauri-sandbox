import { describe, expect, test } from "vitest"
import { createDatabase, requestToPromise } from "../resources/createDatabase"

// Port of w3c test: idbcursor_continue_delete_objectstore.any.js
// Tests IDBObjectStore.delete() and IDBCursor.continue() interaction

interface Record {
    pKey: string
}

describe("IDBObjectStore.delete() and IDBCursor.continue()", () => {
    test("Object store - remove a record from the object store while iterating cursor", async ({
        task,
    }) => {
        /* The goal here is to test that any prefetching of cursor values performs
         * correct invalidation of prefetched data.  This test is motivated by the
         * particularities of the Firefox implementation of preloading, and is
         * specifically motivated by an edge case when prefetching prefetches at
         * least 2 extra records and at most determines whether a mutation is
         * potentially relevant based on current cursor position and direction and
         * does not test for key equivalence.  Future implementations may want to
         * help refine this test if their cursors are more clever.
         *
         * Step-wise we:
         * - Open a cursor, returning key 0.
         * - When the cursor request completes, without yielding control:
         *   - Issue a delete() call that won't actually delete anything but looks
         *     relevant.  This should purge prefetched records 1 and 2.
         *   - Issue a continue() which should result in record 1 being fetched
         *     again and record 2 being prefetched again.
         *   - Delete record 2.  Unless there's a synchronously available source
         *     of truth, the data from continue() above will not be present and
         *     we'll expect the implementation to need to set a flag to invalidate
         *     the prefetched data when it arrives.
         * - When the cursor request completes, validate we got record 1 and issue
         *   a continue.
         * - When the request completes, we should have a null cursor result value
         *   because 2 was deleted.
         */

        const records: Record[] = [
            { pKey: "primaryKey_0" },
            { pKey: "primaryKey_1" },
            { pKey: "primaryKey_2" },
        ]

        // This is a key that is not present in the database, but that is known to
        // be relevant to a forward iteration of the above keys by comparing to be
        // greater than all of them.
        const plausibleFutureKey = "primaryKey_9"

        const db = await createDatabase(task, (database) => {
            const objStore = database.createObjectStore("test", {
                keyPath: "pKey",
            })
            for (let i = 0; i < records.length; i++) {
                objStore.add(records[i])
            }
        })

        // First phase: cursor iteration with deletes
        const txn = db.transaction("test", "readwrite")
        const objectStore = txn.objectStore("test")
        const cursorRequest = objectStore.openCursor()
        let iteration = 0

        // Collect all cursor results
        let cursor = await requestToPromise(cursorRequest)
        while (iteration < 3) {
            switch (iteration) {
                case 0:
                    objectStore.delete(plausibleFutureKey)
                    expect(cursor).not.toBeNull()
                    expect(cursor!.value.pKey).toBe(records[iteration].pKey)
                    cursor!.continue()
                    objectStore.delete(records[2].pKey)
                    break
                case 1:
                    expect(cursor).not.toBeNull()
                    expect(cursor!.value.pKey).toBe(records[iteration].pKey)
                    cursor!.continue()
                    break
                case 2:
                    expect(cursor).toBeNull()
                    break
            }
            iteration++
            if (iteration < 3) {
                cursor = await requestToPromise(cursorRequest)
            }
        }

        // Wait for transaction to complete
        await new Promise<void>((resolve) => {
            txn.oncomplete = () => resolve()
        })

        // Second phase: verify record was deleted
        const readTxn = db.transaction("test", "readonly")
        const readStore = readTxn.objectStore("test")
        const readCursorRequest = readStore.openCursor()

        let count = 0
        let readCursor = await requestToPromise(readCursorRequest)

        while (readCursor) {
            expect(readCursor.value.pKey).toBe(records[count].pKey)
            count++
            readCursor.continue()
            readCursor = await requestToPromise(readCursorRequest)
        }

        expect(count).toBe(2) // Should only have 2 records left
    })
})
