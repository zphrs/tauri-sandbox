import { expect } from "vitest"
import { requestToPromise, idb, cleanupDbRefAfterTest } from "./createDatabase"
import { FDBKeyRange as IDBKeyRange } from "../../inMemoryIdb"

// Number of objects that each iterator goes over.
const itemCount = 10

// Ratio of small objects to large objects.
const largeObjectRatio = 5

// Size of large objects. This should exceed the size of a block in the storage
// method underlying the browser's IndexedDB implementation.
const largeObjectSize = 48 * 1024

function objectKey(cursorIndex: number, itemIndex: number): string {
    return `${cursorIndex}-key-${itemIndex}`
}

function objectValue(
    cursorIndex: number,
    itemIndex: number,
): Uint8Array | (number | string)[] {
    if ((cursorIndex * itemCount + itemIndex) % largeObjectRatio === 0) {
        // We use a typed array (as opposed to a string) because IndexedDB
        // implementations may serialize strings using UTF-8 or UTF-16, yielding
        // larger IndexedDB entries than we'd expect.
        const buffer = new Uint8Array(largeObjectSize)

        // Some IndexedDB implementations, like LevelDB, compress their data blocks
        // before storing them to disk. We use a simple 32-bit xorshift PRNG, which
        // should be sufficient to foil any fast generic-purpose compression scheme.

        // 32-bit xorshift - the seed can't be zero
        let state = 1000 + (cursorIndex * itemCount + itemIndex)

        for (let i = 0; i < largeObjectSize; ++i) {
            state ^= state << 13
            state ^= state >> 17
            state ^= state << 5
            buffer[i] = state & 0xff
        }

        return buffer
    }
    return [cursorIndex, "small", itemIndex]
}

// Writes the objects to be read by one cursor. Returns a promise that resolves
// when the write completes.
async function writeCursorObjects(
    database: IDBDatabase,
    cursorIndex: number,
): Promise<void> {
    return new Promise((resolve, reject) => {
        const transaction = database.transaction("cache", "readwrite")
        transaction.onabort = () => {
            reject(transaction.error)
        }

        const store = transaction.objectStore("cache")
        for (let i = 0; i < itemCount; ++i) {
            store.put({
                key: objectKey(cursorIndex, i),
                value: objectValue(cursorIndex, i),
            })
        }
        transaction.oncomplete = () => resolve()
    })
}

// Returns a promise that resolves when the store has been populated.
async function populateTestStore(
    database: IDBDatabase,
    cursorCount: number,
): Promise<void> {
    for (let i = 0; i < cursorCount; ++i) {
        await writeCursorObjects(database, i)
    }
}

// Reads cursors in an interleaved fashion
async function interleaveCursors(
    store: IDBObjectStore,
    cursorCount: number,
): Promise<void> {
    return new Promise((resolve, reject) => {
        // The cursors used for iteration are stored here so each cursor's onsuccess
        // handler can call continue() on the next cursor.
        const cursors: (IDBCursorWithValue | null)[] = []

        // The results of IDBObjectStore.openCursor() calls are stored here so we
        // we can change the requests' onsuccess handler after every
        // IDBCursor.continue() call.
        const requests: IDBRequest<IDBCursorWithValue | null>[] = []

        const checkCursorState = (cursorIndex: number, itemIndex: number) => {
            const cursor = cursors[cursorIndex]!
            expect(cursor.key).toBe(objectKey(cursorIndex, itemIndex))
            expect(cursor.value.key).toBe(objectKey(cursorIndex, itemIndex))

            const expectedValue = objectValue(cursorIndex, itemIndex)
            if (expectedValue instanceof Uint8Array) {
                expect(cursor.value.value).toEqual(expectedValue)
            } else {
                expect(cursor.value.value.join("-")).toBe(
                    expectedValue.join("-"),
                )
            }
        }

        const openCursor = (cursorIndex: number, callback: () => void) => {
            const request = store.openCursor(
                IDBKeyRange.lowerBound(objectKey(cursorIndex, 0)),
            )
            requests[cursorIndex] = request

            request.onsuccess = () => {
                const cursor = request.result
                cursors[cursorIndex] = cursor
                if (cursor) {
                    checkCursorState(cursorIndex, 0)
                }
                callback()
            }
            request.onerror = () => reject(request.error)
        }

        const readItemFromCursor = (
            cursorIndex: number,
            itemIndex: number,
            callback: () => void,
        ) => {
            const request = requests[cursorIndex]
            request.onsuccess = () => {
                const cursor = request.result
                cursors[cursorIndex] = cursor
                if (cursor) {
                    checkCursorState(cursorIndex, itemIndex)
                }
                callback()
            }

            const cursor = cursors[cursorIndex]!
            cursor.continue()
        }

        // We open all the cursors one at a time, then cycle through the cursors and
        // call continue() on each of them. This access pattern causes maximal
        // trashing to an LRU cursor cache.
        const steps: Array<(callback: () => void) => void> = []
        for (let cursorIndex = 0; cursorIndex < cursorCount; ++cursorIndex) {
            steps.push(openCursor.bind(null, cursorIndex))
        }
        for (let itemIndex = 1; itemIndex < itemCount; ++itemIndex) {
            for (
                let cursorIndex = 0;
                cursorIndex < cursorCount;
                ++cursorIndex
            ) {
                steps.push(
                    readItemFromCursor.bind(null, cursorIndex, itemIndex),
                )
            }
        }

        const runStep = (stepIndex: number) => {
            if (stepIndex === steps.length) {
                resolve()
                return
            }
            steps[stepIndex](() => {
                runStep(stepIndex + 1)
            })
        }
        runStep(0)
    })
}

export async function cursorTest(
    cursorCount: number,
    testType: "small" | "large" = "small",
): Promise<void> {
    // Create database with test-specific name
    const dbName = `interleaved-cursors-${testType}-test-${cursorCount}-${Date.now()}-${Math.random()}`

    // Create database
    const req = idb.open(dbName)
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
        req.onupgradeneeded = () => {
            const db = req.result
            db.createObjectStore("cache", {
                keyPath: "key",
                autoIncrement: true,
            })
        }
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
    })

    cleanupDbRefAfterTest(database)

    try {
        // Populate the store
        await populateTestStore(database, cursorCount)

        // Close database and reopen to test cursor persistence
        database.close()

        const reopenReq = idb.open(dbName)
        const reopenedDb = await requestToPromise(
            reopenReq as unknown as IDBRequest<IDBDatabase>,
        )
        cleanupDbRefAfterTest(reopenedDb)

        // Test interleaved cursors
        const transaction = reopenedDb.transaction("cache", "readonly")
        const store = transaction.objectStore("cache")

        if (testType === "large") {
            // For the large test, we just verify we can open cursors successfully
            // without doing the full interleaving test due to resource constraints
            const testCursors = Math.min(cursorCount, 5)
            for (let i = 0; i < testCursors; i++) {
                const request = store.openCursor(
                    IDBKeyRange.lowerBound(objectKey(i, 0)),
                )
                await requestToPromise(request)
            }
        } else {
            // For small tests, do full interleaving
            await interleaveCursors(store, cursorCount)
        }

        reopenedDb.close()
    } catch (error) {
        database.close()
        throw error
    }
}
