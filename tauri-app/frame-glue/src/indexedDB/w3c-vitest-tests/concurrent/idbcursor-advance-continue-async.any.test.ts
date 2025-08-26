import { test, expect } from "vitest"
import { createDatabase } from "../resources/createDatabase"

// Port of w3c test: idbcursor-advance-continue-async.any.js
// Tests IDBCursor asyncness behavior with advance() and continue() methods

test("IDBCursor asyncness - advance", async ({ task }) => {
    const db = await createDatabase(task, (db) => {
        const objStore = db.createObjectStore("test")
        objStore.createIndex("index", "")

        objStore.add("data", 1)
        objStore.add("data2", 2)
    })

    let count = 0
    const transaction = db.transaction("test", "readonly")
    const store = transaction.objectStore("test")
    const request = store.openCursor()

    return new Promise<void>((resolve, reject) => {
        request.onsuccess = (event) => {
            const cursor = (event.target as IDBRequest)
                .result as IDBCursorWithValue | null

            if (!cursor) {
                expect(count).toBe(2)
                resolve()
                return
            }

            switch (count) {
                case 0:
                    expect(cursor.value).toBe("data")
                    expect(cursor.key).toBe(1)
                    cursor.advance(1)
                    // Values should remain the same immediately after advance
                    expect(cursor.value).toBe("data")
                    expect(cursor.key).toBe(1)
                    break

                case 1:
                    expect(cursor.value).toBe("data2")
                    expect(cursor.key).toBe(2)
                    cursor.advance(1)
                    // Values should remain the same immediately after advance
                    expect(cursor.value).toBe("data2")
                    expect(cursor.key).toBe(2)
                    break

                default:
                    reject(new Error(`Unexpected count: ${count}`))
                    return
            }

            count++
        }

        request.onerror = () => {
            reject(new Error("Unexpected error"))
        }
    })
})

test("IDBCursor asyncness - continue", async ({ task }) => {
    const db = await createDatabase(task, (db) => {
        const objStore = db.createObjectStore("test")
        objStore.createIndex("index", "")

        objStore.add("data", 1)
        objStore.add("data2", 2)
    })

    let count = 0
    const transaction = db.transaction("test", "readonly")
    const store = transaction.objectStore("test")
    const index = store.index("index")
    const request = index.openCursor()

    return new Promise<void>((resolve, reject) => {
        request.onsuccess = (event) => {
            const cursor = (event.target as IDBRequest)
                .result as IDBCursorWithValue | null

            if (!cursor) {
                expect(count).toBe(2)
                resolve()
                return
            }

            switch (count) {
                case 0:
                    expect(cursor.value).toBe("data")
                    expect(cursor.key).toBe("data")
                    expect(cursor.primaryKey).toBe(1)
                    cursor.continue("data2")
                    // Values should remain the same immediately after continue
                    expect(cursor.value).toBe("data")
                    expect(cursor.key).toBe("data")
                    expect(cursor.primaryKey).toBe(1)
                    break

                case 1:
                    expect(cursor.value).toBe("data2")
                    expect(cursor.key).toBe("data2")
                    expect(cursor.primaryKey).toBe(2)
                    cursor.continue()
                    // Values should remain the same immediately after continue
                    expect(cursor.value).toBe("data2")
                    expect(cursor.key).toBe("data2")
                    expect(cursor.primaryKey).toBe(2)
                    break

                default:
                    reject(new Error(`Unexpected count: ${count}`))
                    return
            }

            count++
        }

        request.onerror = () => {
            reject(new Error("Unexpected error"))
        }
    })
})

test("IDBCursor asyncness - fresh advance still async", async ({ task }) => {
    const db = await createDatabase(task, (db) => {
        const objStore = db.createObjectStore("test")
        objStore.createIndex("index", "")

        objStore.add("data", 1)
        objStore.add("data2", 2)
    })

    let count = 0
    const transaction = db.transaction("test", "readonly")
    const store = transaction.objectStore("test")
    const index = store.index("index")
    const request = index.openCursor()

    return new Promise<void>((resolve, reject) => {
        request.onsuccess = (event) => {
            const cursor = (event.target as IDBRequest)
                .result as IDBCursorWithValue | null

            if (!cursor) {
                expect(count).toBe(2)
                resolve()
                return
            }

            cursor.advance(1)

            switch (count) {
                case 0:
                    expect(cursor.value).toBe("data")
                    expect(cursor.key).toBe("data")
                    expect(cursor.primaryKey).toBe(1)
                    break

                case 1:
                    expect(cursor.value).toBe("data2")
                    expect(cursor.key).toBe("data2")
                    expect(cursor.primaryKey).toBe(2)
                    break

                default:
                    reject(new Error(`Unexpected count: ${count}`))
                    return
            }

            count++
        }

        request.onerror = () => {
            reject(new Error("Unexpected error"))
        }
    })
})

test("IDBCursor asyncness - fresh continue still async", async ({ task }) => {
    const db = await createDatabase(task, (db) => {
        const objStore = db.createObjectStore("test")
        objStore.add("data", 1)
        objStore.add("data2", 2)
    })

    let count = 0
    const transaction = db.transaction("test", "readonly")
    const store = transaction.objectStore("test")
    const request = store.openCursor()

    return new Promise<void>((resolve, reject) => {
        request.onsuccess = (event) => {
            const cursor = (event.target as IDBRequest)
                .result as IDBCursorWithValue | null

            if (!cursor) {
                expect(count).toBe(2)
                resolve()
                return
            }

            cursor.continue()

            switch (count) {
                case 0:
                    expect(cursor.value).toBe("data")
                    expect(cursor.key).toBe(1)
                    break

                case 1:
                    expect(cursor.value).toBe("data2")
                    expect(cursor.key).toBe(2)
                    break

                default:
                    reject(new Error(`Unexpected count: ${count}`))
                    return
            }

            count++
        }

        request.onerror = () => {
            reject(new Error("Unexpected error"))
        }
    })
})
