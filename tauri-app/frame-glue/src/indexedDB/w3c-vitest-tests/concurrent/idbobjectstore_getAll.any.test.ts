import { describe, expect, test } from "vitest"
import { createDatabase, requestToPromise } from "../resources/createDatabase"
import { FDBKeyRange as IDBKeyRange } from "../../inMemoryIdb"

// Port of w3c test: idbobjectstore_getAll.any.js
// Tests IDBObjectStore.getAll() method functionality

const alphabet = "abcdefghijklmnopqrstuvwxyz".split("")

// Helper function to create large values for testing
function largeValue(size: number, seed: number): ArrayBuffer {
    const buffer = new ArrayBuffer(size)
    const view = new Uint8Array(buffer)
    for (let i = 0; i < size; i++) {
        view[i] = (seed + i) % 256
    }
    return buffer
}

describe("IDBObjectStore.getAll()", () => {
    test("Single item get", async ({ task }) => {
        const db = await createDatabase(task, (db) => {
            const store = db.createObjectStore("out-of-line")
            alphabet.forEach((letter) => {
                store.put(`value-${letter}`, letter)
            })
        })

        const tx = db.transaction("out-of-line", "readonly")
        const store = tx.objectStore("out-of-line")
        const result = await requestToPromise(store.getAll("c"))

        expect(result).toEqual(["value-c"])
    })

    test("Single item get (generated key)", async ({ task }) => {
        const db = await createDatabase(task, (db) => {
            const store = db.createObjectStore("generated", {
                autoIncrement: true,
                keyPath: "id",
            })
            alphabet.forEach((letter) => {
                store.put({ ch: letter })
            })
        })

        const tx = db.transaction("generated", "readonly")
        const store = tx.objectStore("generated")
        const result = await requestToPromise(store.getAll(3))

        expect(result).toEqual([{ id: 3, ch: "c" }])
    })

    test("getAll on empty object store", async ({ task }) => {
        const db = await createDatabase(task, (db) => {
            db.createObjectStore("empty")
        })

        const tx = db.transaction("empty", "readonly")
        const store = tx.objectStore("empty")
        const result = await requestToPromise(store.getAll())

        expect(result).toEqual([])
    })

    test("Get all values", async ({ task }) => {
        const db = await createDatabase(task, (db) => {
            const store = db.createObjectStore("out-of-line")
            alphabet.forEach((letter) => {
                store.put(`value-${letter}`, letter)
            })
        })

        const tx = db.transaction("out-of-line", "readonly")
        const store = tx.objectStore("out-of-line")
        const result = await requestToPromise(store.getAll())

        const expected = alphabet.map((letter) => `value-${letter}`)
        expect(result).toEqual(expected)
    })

    test("Get all with large values", async ({ task }) => {
        const db = await createDatabase(task, (db) => {
            const store = db.createObjectStore("large-values")
            for (let i = 0; i < 3; i++) {
                const value = largeValue(1024, i)
                store.put(value, i)
            }
        })

        const tx = db.transaction("large-values", "readonly")
        const store = tx.objectStore("large-values")
        const result = await requestToPromise(store.getAll())

        expect(result).toHaveLength(3)
        result.forEach((value) => {
            expect(value).toBeInstanceOf(ArrayBuffer)
            expect(value.byteLength).toBe(1024)
        })
    })

    test("Test maxCount", async ({ task }) => {
        const db = await createDatabase(task, (db) => {
            const store = db.createObjectStore("out-of-line")
            alphabet.forEach((letter) => {
                store.put(`value-${letter}`, letter)
            })
        })

        const tx = db.transaction("out-of-line", "readonly")
        const store = tx.objectStore("out-of-line")
        const result = await requestToPromise(store.getAll(undefined, 10))

        expect(result).toHaveLength(10)
        const expected = alphabet
            .slice(0, 10)
            .map((letter) => `value-${letter}`)
        expect(result).toEqual(expected)
    })

    test("Get bound range", async ({ task }) => {
        const db = await createDatabase(task, (db) => {
            const store = db.createObjectStore("out-of-line")
            alphabet.forEach((letter) => {
                store.put(`value-${letter}`, letter)
            })
        })

        const tx = db.transaction("out-of-line", "readonly")
        const store = tx.objectStore("out-of-line")
        const result = await requestToPromise(
            store.getAll(IDBKeyRange.bound("g", "m")),
        )

        const expectedKeys = ["g", "h", "i", "j", "k", "l", "m"]
        const expected = expectedKeys.map((letter) => `value-${letter}`)
        expect(result).toEqual(expected)
    })

    test("Get bound range with maxCount", async ({ task }) => {
        const db = await createDatabase(task, (db) => {
            const store = db.createObjectStore("out-of-line")
            alphabet.forEach((letter) => {
                store.put(`value-${letter}`, letter)
            })
        })

        const tx = db.transaction("out-of-line", "readonly")
        const store = tx.objectStore("out-of-line")
        const result = await requestToPromise(
            store.getAll(IDBKeyRange.bound("g", "m"), 3),
        )

        expect(result).toHaveLength(3)
        const expected = ["g", "h", "i"].map((letter) => `value-${letter}`)
        expect(result).toEqual(expected)
    })

    test("Get upper excluded", async ({ task }) => {
        const db = await createDatabase(task, (db) => {
            const store = db.createObjectStore("out-of-line")
            alphabet.forEach((letter) => {
                store.put(`value-${letter}`, letter)
            })
        })

        const tx = db.transaction("out-of-line", "readonly")
        const store = tx.objectStore("out-of-line")
        const result = await requestToPromise(
            store.getAll(IDBKeyRange.bound("g", "k", false, true)),
        )

        const expectedKeys = ["g", "h", "i", "j"]
        const expected = expectedKeys.map((letter) => `value-${letter}`)
        expect(result).toEqual(expected)
    })

    test("Get lower excluded", async ({ task }) => {
        const db = await createDatabase(task, (db) => {
            const store = db.createObjectStore("out-of-line")
            alphabet.forEach((letter) => {
                store.put(`value-${letter}`, letter)
            })
        })

        const tx = db.transaction("out-of-line", "readonly")
        const store = tx.objectStore("out-of-line")
        const result = await requestToPromise(
            store.getAll(IDBKeyRange.bound("g", "k", true, false)),
        )

        const expectedKeys = ["h", "i", "j", "k"]
        const expected = expectedKeys.map((letter) => `value-${letter}`)
        expect(result).toEqual(expected)
    })

    test("Get bound range (generated) with maxCount", async ({ task }) => {
        const db = await createDatabase(task, (db) => {
            const store = db.createObjectStore("generated", {
                autoIncrement: true,
                keyPath: "id",
            })
            for (let i = 0; i < 20; i++) {
                store.put({ ch: alphabet[i % alphabet.length] })
            }
        })

        const tx = db.transaction("generated", "readonly")
        const store = tx.objectStore("generated")
        const result = await requestToPromise(
            store.getAll(IDBKeyRange.bound(4, 15), 3),
        )

        expect(result).toHaveLength(3)
        expect(result[0].id).toBe(4)
        expect(result[1].id).toBe(5)
        expect(result[2].id).toBe(6)
    })

    test("Non existent key", async ({ task }) => {
        const db = await createDatabase(task, (db) => {
            const store = db.createObjectStore("out-of-line")
            alphabet.forEach((letter) => {
                store.put(`value-${letter}`, letter)
            })
        })

        const tx = db.transaction("out-of-line", "readonly")
        const store = tx.objectStore("out-of-line")
        const result = await requestToPromise(store.getAll("Doesn't exist"))

        expect(result).toEqual([])
    })

    test("zero maxCount", async ({ task }) => {
        const db = await createDatabase(task, (db) => {
            const store = db.createObjectStore("out-of-line")
            alphabet.forEach((letter) => {
                store.put(`value-${letter}`, letter)
            })
        })

        const tx = db.transaction("out-of-line", "readonly")
        const store = tx.objectStore("out-of-line")
        const result = await requestToPromise(store.getAll(undefined, 0))

        // count: 0 should behave the same as no count (return all records)
        const expected = alphabet.map((letter) => `value-${letter}`)
        expect(result).toEqual(expected)
    })

    test("Max value count", async ({ task }) => {
        const db = await createDatabase(task, (db) => {
            const store = db.createObjectStore("out-of-line")
            alphabet.forEach((letter) => {
                store.put(`value-${letter}`, letter)
            })
        })

        const tx = db.transaction("out-of-line", "readonly")
        const store = tx.objectStore("out-of-line")
        const result = await requestToPromise(
            store.getAll(undefined, 4294967295),
        )

        const expected = alphabet.map((letter) => `value-${letter}`)
        expect(result).toEqual(expected)
    })

    test("Query with empty range where first key < upperBound", async ({
        task,
    }) => {
        const db = await createDatabase(task, (db) => {
            const store = db.createObjectStore("out-of-line")
            alphabet.forEach((letter) => {
                store.put(`value-${letter}`, letter)
            })
        })

        const tx = db.transaction("out-of-line", "readonly")
        const store = tx.objectStore("out-of-line")
        const result = await requestToPromise(
            store.getAll(IDBKeyRange.upperBound("0")),
        )

        expect(result).toEqual([])
    })

    test("Query with empty range where lowerBound < last key", async ({
        task,
    }) => {
        const db = await createDatabase(task, (db) => {
            const store = db.createObjectStore("out-of-line")
            alphabet.forEach((letter) => {
                store.put(`value-${letter}`, letter)
            })
        })

        const tx = db.transaction("out-of-line", "readonly")
        const store = tx.objectStore("out-of-line")
        const result = await requestToPromise(
            store.getAll(IDBKeyRange.lowerBound("zz")),
        )

        expect(result).toEqual([])
    })
})
