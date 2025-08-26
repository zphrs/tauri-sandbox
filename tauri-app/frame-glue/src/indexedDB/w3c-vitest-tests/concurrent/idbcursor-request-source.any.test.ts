import { describe, expect, test } from "vitest"
import { createDatabase, requestToPromise } from "../resources/createDatabase"

// Port of w3c test: idbcursor-request-source.any.js
// Tests the source of requests made against cursors

// Setup each test by populating an object store with an index for the cursor to
// iterate and manipulate.
function initializeDatabase(db: IDBDatabase) {
    const store = db.createObjectStore("store", { autoIncrement: true })
    store.createIndex("index", "value")
    store.put({ value: "z" })
    store.put({ value: "y" })
    store.put({ value: "x" })
    store.put({ value: "w" })
}

function isIndex(cursorSourceType: string) {
    return cursorSourceType === "IDBIndex"
}

// Return the object store or index, depending on the test's cursorSourceType.
function getCursorSource(
    transaction: IDBTransaction,
    cursorSourceType: string,
) {
    let cursorSource: IDBObjectStore | IDBIndex =
        transaction.objectStore("store")
    if (isIndex(cursorSourceType)) {
        cursorSource = cursorSource.index("index")
    }
    return cursorSource
}

describe("IDBCursor request source", () => {
    // Verify the request source after calling delete() or update() on the cursor.
    describe("cursor modification request sources", () => {
        test("IDBObjectStore cursor update() request source is the cursor", async ({
            task,
        }) => {
            const db = await createDatabase(task, initializeDatabase)
            const tx = db.transaction("store", "readwrite")
            const cursorSource = getCursorSource(tx, "IDBObjectStore")

            // Open the cursor
            const openCursorRequest = cursorSource.openCursor()
            const cursor = await requestToPromise(openCursorRequest)

            expect(cursor).not.toBeNull()

            // Use the cursor to create a new request
            const request = cursor!.update(0)
            expect(request.source).toBe(cursor)
        })

        test("IDBObjectStore cursor delete() request source is the cursor", async ({
            task,
        }) => {
            const db = await createDatabase(task, initializeDatabase)
            const tx = db.transaction("store", "readwrite")
            const cursorSource = getCursorSource(tx, "IDBObjectStore")

            // Open the cursor
            const openCursorRequest = cursorSource.openCursor()
            const cursor = await requestToPromise(openCursorRequest)

            expect(cursor).not.toBeNull()

            // Use the cursor to create a new request
            const request = cursor!.delete()
            expect(request.source).toBe(cursor)
        })

        test("IDBIndex cursor update() request source is the cursor", async ({
            task,
        }) => {
            const db = await createDatabase(task, initializeDatabase)
            const tx = db.transaction("store", "readwrite")
            const cursorSource = getCursorSource(tx, "IDBIndex")

            // Open the cursor
            const openCursorRequest = cursorSource.openCursor()
            const cursor = await requestToPromise(openCursorRequest)

            expect(cursor).not.toBeNull()

            // Use the cursor to create a new request
            const request = (cursor as IDBCursorWithValue)!.update(0)
            expect(request.source).toBe(cursor)
        })

        test("IDBIndex cursor delete() request source is the cursor", async ({
            task,
        }) => {
            const db = await createDatabase(task, initializeDatabase)
            const tx = db.transaction("store", "readwrite")
            const cursorSource = getCursorSource(tx, "IDBIndex")

            // Open the cursor
            const openCursorRequest = cursorSource.openCursor()
            const cursor = await requestToPromise(openCursorRequest)

            expect(cursor).not.toBeNull()

            // Use the cursor to create a new request
            const request = cursor!.delete()
            expect(request.source).toBe(cursor)
        })
    })

    // Verify the request source after calling openCursor() or openKeyCursor() and
    // then using the cursor to iterate.
    describe("cursor opening request sources", () => {
        test("IDBObjectStore openCursor() request source is the object store", async ({
            task,
        }) => {
            const db = await createDatabase(task, initializeDatabase)
            const tx = db.transaction("store", "readonly")
            const cursorSource = getCursorSource(tx, "IDBObjectStore")

            // Open the cursor
            const openCursorRequest = cursorSource.openCursor()

            expect(openCursorRequest.source).toBe(cursorSource)

            let iterationCount = 0

            while (true) {
                const cursor = await requestToPromise(openCursorRequest)

                expect(openCursorRequest.source).toBe(cursorSource)

                if (!cursor) break

                iterationCount++

                if (iterationCount === 1) {
                    cursor.advance(1)
                } else if (iterationCount === 2) {
                    cursor.continue()
                } else {
                    break
                }
            }

            expect(iterationCount).toBeGreaterThan(0)
        })

        test("IDBObjectStore openKeyCursor() request source is the object store", async ({
            task,
        }) => {
            const db = await createDatabase(task, initializeDatabase)
            const tx = db.transaction("store", "readonly")
            const cursorSource = getCursorSource(tx, "IDBObjectStore")

            // Open the cursor
            const openCursorRequest = cursorSource.openKeyCursor()

            expect(openCursorRequest.source).toBe(cursorSource)

            let iterationCount = 0

            while (true) {
                const cursor = await requestToPromise(openCursorRequest)

                expect(openCursorRequest.source).toBe(cursorSource)

                if (!cursor) break

                iterationCount++

                if (iterationCount === 1) {
                    cursor.advance(1)
                } else if (iterationCount === 2) {
                    cursor.continue()
                } else {
                    break
                }
            }

            expect(iterationCount).toBeGreaterThan(0)
        })

        test("IDBIndex openCursor() request source is the index", async ({
            task,
        }) => {
            const db = await createDatabase(task, initializeDatabase)
            const tx = db.transaction("store", "readonly")
            const cursorSource = getCursorSource(tx, "IDBIndex")

            // Open the cursor
            const openCursorRequest = cursorSource.openCursor()

            expect(openCursorRequest.source).toBe(cursorSource)

            let iterationCount = 0

            while (true) {
                const cursor = await requestToPromise(openCursorRequest)

                expect(openCursorRequest.source).toBe(cursorSource)

                if (!cursor) break

                iterationCount++

                if (iterationCount === 1) {
                    cursor.advance(1)
                } else if (iterationCount === 2) {
                    cursor.continue()
                } else if (iterationCount === 3) {
                    cursor.continuePrimaryKey("z", 0)
                } else {
                    break
                }
            }

            expect(iterationCount).toBeGreaterThan(0)
        })

        test("IDBIndex openKeyCursor() request source is the index", async ({
            task,
        }) => {
            const db = await createDatabase(task, initializeDatabase)
            const tx = db.transaction("store", "readonly")
            const cursorSource = getCursorSource(tx, "IDBIndex")

            // Open the cursor
            const openCursorRequest = cursorSource.openKeyCursor()

            expect(openCursorRequest.source).toBe(cursorSource)

            let iterationCount = 0

            while (true) {
                const cursor = await requestToPromise(openCursorRequest)

                expect(openCursorRequest.source).toBe(cursorSource)

                if (!cursor) break

                iterationCount++

                if (iterationCount === 1) {
                    cursor.advance(1)
                } else if (iterationCount === 2) {
                    cursor.continue()
                } else if (iterationCount === 3) {
                    cursor.continuePrimaryKey("z", 0)
                } else {
                    break
                }
            }

            expect(iterationCount).toBeGreaterThan(0)
        })
    })
})
