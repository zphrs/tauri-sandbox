import { describe, expect, test } from "vitest"
import { createDatabase } from "../resources/createDatabase"
import { FDBKeyRange as IDBKeyRange } from "../../inMemoryIdb"

// Port of w3c test: large-requests-abort.any.js
// Tests that transactions with large request results are aborted correctly

// Should be large enough to trigger large value handling in the IndexedDB
// engines that have special code paths for large values.
const wrapThreshold = 128 * 1024

// Helper function to create large values
function largeValue(size: number, seed: number): Uint8Array {
    const buffer = new Uint8Array(size)
    // Fill with a lot of the same byte.
    if (seed == 0) {
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

function populateStore(store: IDBObjectStore) {
    store.put({ id: 1, key: "k1", value: largeValue(wrapThreshold, 1) })
    store.put({ id: 2, key: "k2", value: ["small-2"] })
    store.put({ id: 3, key: "k3", value: largeValue(wrapThreshold, 3) })
    store.put({ id: 4, key: "k4", value: ["small-4"] })
}

// Opens index cursors for operations that require open cursors.
//
// onsuccess is called if all cursors are opened successfully. Otherwise,
// onerror will be called at least once.
function openCursors(
    index: IDBIndex,
    operations: Array<[string, number | null, IDBRequest?]>,
    onerror: () => void,
    onsuccess: () => void,
) {
    let pendingCursors = 0

    for (const operation of operations) {
        const opcode = operation[0]
        const primaryKey = operation[1]
        let request: IDBRequest
        switch (opcode) {
            case "continue":
                request = index.openCursor(
                    IDBKeyRange.lowerBound(`k${primaryKey! - 1}`),
                )
                break
            case "continue-empty":
                // k4 is the last key in the data set, so calling continue() will get
                // the cursor past the end of the store.
                request = index.openCursor(IDBKeyRange.lowerBound("k4"))
                break
            default:
                continue
        }

        operation[2] = request
        ++pendingCursors

        request.onsuccess = () => {
            --pendingCursors
            if (!pendingCursors) onsuccess()
        }
        request.onerror = onerror
    }

    if (!pendingCursors) onsuccess()
}

function doOperation(
    store: IDBObjectStore,
    index: IDBIndex,
    operation: [string, number | null, IDBRequest?],
    requestId: number,
    results: Array<[number, DOMException]>,
): Promise<void> {
    const opcode = operation[0]
    const primaryKey = operation[1]
    const cursor = operation[2]

    return new Promise((resolve, reject) => {
        let request: IDBRequest
        switch (opcode) {
            case "add": // Tests returning a primary key.
                request = store.add({
                    key: `k${primaryKey}`,
                    value: [`small-${primaryKey}`],
                })
                break
            case "put": // Tests returning a primary key.
                request = store.put({
                    key: `k${primaryKey}`,
                    value: [`small-${primaryKey}`],
                })
                break
            case "put-with-id": // Tests returning success or a primary key.
                request = store.put({
                    key: `k${primaryKey}`,
                    value: [`small-${primaryKey}`],
                    id: primaryKey,
                })
                break
            case "get": // Tests returning a value.
            case "get-empty": // Tests returning undefined.
                request = store.get(primaryKey!)
                break
            case "getall": // Tests returning an array of values.
                request = store.getAll()
                break
            case "error": // Tests returning an error.
                request = store.put({
                    key: `k${primaryKey}`,
                    value: [`small-${primaryKey}`],
                })
                break
            case "continue": // Tests returning a key, primary key, and value.
            case "continue-empty": // Tests returning null.
                request = cursor!
                ;(cursor!.result as IDBCursor).continue()
                break
            case "open": // Tests returning a cursor, key, primary key, and value.
            case "open-empty": // Tests returning null.
                request = index.openCursor(
                    IDBKeyRange.lowerBound(`k${primaryKey}`),
                )
                break
            case "count": // Tests returning a numeric result.
                request = index.count()
                break
            default:
                throw new Error(`Unknown operation: ${opcode}`)
        }

        request.onsuccess = () => {
            reject(
                new Error(
                    "requests should not succeed after the transaction is aborted",
                ),
            )
        }
        request.onerror = (event) => {
            event.preventDefault()
            results.push([requestId, request.error as DOMException])
            resolve()
        }
    })
}

function abortTest(label: string, operations: Array<[string, number | null]>) {
    test(label, async ({ task }) => {
        const db = await createDatabase(task, (database) => {
            const store = database.createObjectStore("test-store", {
                autoIncrement: true,
                keyPath: "id",
            })
            store.createIndex("test-index", "key", { unique: true })
            populateStore(store)
        })

        const transaction = db.transaction(["test-store"], "readwrite")
        const store = transaction.objectStore("test-store")
        const index = store.index("test-index")

        const results = await new Promise<Array<[number, DOMException]>>(
            (resolve, reject) => {
                const operationsWithRequests: Array<
                    [string, number | null, IDBRequest?]
                > = operations.map((op) => [...op, undefined])

                openCursors(
                    index,
                    operationsWithRequests,
                    () => reject(new Error("Failed to open cursors")),
                    () => {
                        const results: Array<[number, DOMException]> = []
                        const promises: Array<Promise<void>> = []
                        for (
                            let i = 0;
                            i < operationsWithRequests.length;
                            ++i
                        ) {
                            const promise = doOperation(
                                store,
                                index,
                                operationsWithRequests[i],
                                i,
                                results,
                            )
                            promises.push(promise)
                        }
                        transaction.abort()
                        resolve(Promise.all(promises).then(() => results))
                    },
                )
            },
        )

        expect(results.length).toBe(operations.length)
        expect(
            results.length,
            "Promise.all should resolve after all sub-promises resolve",
        ).toBe(operations.length)

        for (let i = 0; i < operations.length; ++i) {
            expect(
                results[i][0],
                "error event order should match request order",
            ).toBe(i)
            expect(
                results[i][1].name,
                "transaction aborting should result in AbortError on all requests",
            ).toBe("AbortError")
        }
    })
}

describe("large-requests-abort", () => {
    abortTest("small values", [
        ["get", 2],
        ["count", null],
        ["continue-empty", null],
        ["get-empty", 5],
        ["add", 5],
        ["open", 2],
        ["continue", 2],
        ["get", 4],
        ["get-empty", 6],
        ["count", null],
        ["put-with-id", 5],
        ["put", 6],
        ["error", 3],
        ["continue", 4],
        ["count", null],
        ["get-empty", 7],
        ["open", 4],
        ["open-empty", 7],
        ["add", 7],
    ])

    abortTest("large values", [
        ["open", 1],
        ["get", 1],
        ["getall", 4],
        ["get", 3],
        ["continue", 3],
        ["open", 3],
    ])

    abortTest("large value followed by small values", [
        ["get", 1],
        ["getall", null],
        ["open", 2],
        ["continue-empty", null],
        ["get", 2],
        ["get-empty", 5],
        ["count", null],
        ["continue-empty", null],
        ["open-empty", 5],
        ["add", 5],
        ["error", 1],
        ["continue", 2],
        ["get-empty", 6],
        ["put-with-id", 5],
        ["put", 6],
    ])

    abortTest("large values mixed with small values", [
        ["get", 1],
        ["get", 2],
        ["get-empty", 5],
        ["count", null],
        ["continue-empty", null],
        ["open", 1],
        ["continue", 2],
        ["open-empty", 5],
        ["getall", 4],
        ["open", 2],
        ["continue-empty", null],
        ["add", 5],
        ["get", 3],
        ["count", null],
        ["get-empty", 6],
        ["put-with-id", 5],
        ["getall", null],
        ["continue", 3],
        ["open-empty", 6],
        ["put", 6],
        ["error", 1],
        ["continue", 2],
        ["open", 4],
        ["get-empty", 7],
        ["count", null],
        ["continue", 3],
        ["add", 7],
        ["getall", null],
        ["error", 3],
        ["count", null],
    ])
})
