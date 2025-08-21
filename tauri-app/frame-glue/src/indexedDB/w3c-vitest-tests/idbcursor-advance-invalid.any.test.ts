import { describe, expect, test } from "vitest"
import { createDatabase, requestToPromise } from "./resources/createDatabase"

// Port of w3c test: idbcursor-advance-invalid.any.js
// Tests invalid calls to IDBCursor.advance() method

function upgradeFunc(db: IDBDatabase) {
    const objStore = db.createObjectStore("test")
    objStore.createIndex("index", "")

    objStore.add("data", 1)
    objStore.add("data2", 2)
}

describe("IDBCursor.advance() - invalid", () => {
    test("attempt to call advance twice", async ({ task }) => {
        const db = await createDatabase(task, upgradeFunc)

        let count = 0
        const tx = db.transaction("test", "readonly")
        const store = tx.objectStore("test")
        const index = store.index("index")
        const request = index.openCursor()

        const cursor = await requestToPromise<IDBCursorWithValue | null>(
            request,
        )
        expect(cursor).not.toBeNull()

        if (cursor) {
            cursor.advance(1)

            // Second try should throw InvalidStateError
            expect(() => {
                cursor.advance(1)
            }).toThrow(DOMException)
            expect(() => {
                cursor.advance(1)
            }).toThrow(/InvalidStateError/)

            // Third advance should also throw InvalidStateError
            expect(() => {
                cursor.advance(3)
            }).toThrow(DOMException)
            expect(() => {
                cursor.advance(3)
            }).toThrow(/InvalidStateError/)

            count++
        }

        expect(count).toBe(1)
    })

    test("pass something other than number", async ({ task }) => {
        const db = await createDatabase(task, upgradeFunc)

        const tx = db.transaction("test", "readonly")
        const store = tx.objectStore("test")
        const index = store.index("index")
        const request = index.openCursor()

        const cursor = await requestToPromise<IDBCursorWithValue | null>(
            request,
        )
        expect(cursor).not.toBeNull()

        if (cursor) {
            expect(() => {
                cursor.advance(self as unknown as number)
            }).toThrow(TypeError)

            expect(() => {
                cursor.advance({} as unknown as number)
            }).toThrow(TypeError)

            expect(() => {
                cursor.advance([] as unknown as number)
            }).toThrow(TypeError)

            expect(() => {
                cursor.advance("" as unknown as number)
            }).toThrow(TypeError)

            expect(() => {
                cursor.advance("1 2" as unknown as number)
            }).toThrow(TypeError)
        }
    })

    test("pass null/undefined", async ({ task }) => {
        const db = await createDatabase(task, upgradeFunc)

        const tx = db.transaction("test", "readonly")
        const store = tx.objectStore("test")
        const index = store.index("index")
        const request = index.openCursor()

        const cursor = await requestToPromise<IDBCursorWithValue | null>(
            request,
        )
        expect(cursor).not.toBeNull()

        if (cursor) {
            expect(() => {
                cursor.advance(null as unknown as number)
            }).toThrow(TypeError)

            expect(() => {
                cursor.advance(undefined as unknown as number)
            }).toThrow(TypeError)

            const mylet = null
            expect(() => {
                cursor.advance(mylet as unknown as number)
            }).toThrow(TypeError)
        }
    })

    test("missing argument", async ({ task }) => {
        const db = await createDatabase(task, upgradeFunc)

        const tx = db.transaction("test", "readonly")
        const store = tx.objectStore("test")
        const index = store.index("index")
        const request = index.openCursor()

        const cursor = await requestToPromise<IDBCursorWithValue | null>(
            request,
        )
        expect(cursor).not.toBeNull()

        if (cursor) {
            expect(() => {
                ;(cursor.advance as (count?: number) => void)()
            }).toThrow(TypeError)
        }
    })

    test("pass negative numbers", async ({ task }) => {
        const db = await createDatabase(task, upgradeFunc)

        const tx = db.transaction("test", "readonly")
        const store = tx.objectStore("test")
        const index = store.index("index")
        const request = index.openCursor()

        const cursor = await requestToPromise<IDBCursorWithValue | null>(
            request,
        )
        expect(cursor).not.toBeNull()

        if (cursor) {
            expect(() => {
                cursor.advance(-1)
            }).toThrow(TypeError)

            expect(() => {
                cursor.advance(NaN)
            }).toThrow(TypeError)

            expect(() => {
                cursor.advance(0)
            }).toThrow(TypeError)

            expect(() => {
                cursor.advance(-0)
            }).toThrow(TypeError)

            expect(() => {
                cursor.advance(Infinity)
            }).toThrow(TypeError)

            expect(() => {
                cursor.advance(-Infinity)
            }).toThrow(TypeError)

            const mylet = -999999
            expect(() => {
                cursor.advance(mylet)
            }).toThrow(TypeError)
        }
    })

    test("got value not set on exception", async ({ task }) => {
        const db = await createDatabase(task, upgradeFunc)

        let count = 0
        const tx = db.transaction("test", "readonly")
        const store = tx.objectStore("test")
        const index = store.index("index")

        return new Promise<void>((resolve, reject) => {
            const request = index.openCursor()

            request.onsuccess = (e) => {
                const cursor = (e.target as IDBRequest).result
                if (!cursor) {
                    expect(count).toBe(2)
                    resolve()
                    return
                }

                try {
                    expect(() => {
                        cursor.advance(0)
                    }).toThrow(TypeError)

                    cursor.advance(1)
                    count++
                } catch (error) {
                    reject(error)
                }
            }

            request.onerror = () => {
                reject(request.error)
            }
        })
    })
})
