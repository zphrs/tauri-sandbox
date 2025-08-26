import { describe, expect, test } from "vitest"
import { createDatabase, requestToPromise } from "../resources/createDatabase"
import { FDBKeyRange as IDBKeyRange } from "../../inMemoryIdb"

// Port of w3c test: idbobjectstore_getAllKeys.any.js
// Tests IDBObjectStore.getAllKeys() method functionality

const alphabet = "abcdefghijklmnopqrstuvwxyz".split("")

describe("IDBObjectStore.getAllKeys()", () => {
    test("Single item get", async ({ task }) => {
        const db = await createDatabase(task, (db) => {
            const store = db.createObjectStore("out-of-line")
            alphabet.forEach((letter) => {
                store.put(`value-${letter}`, letter)
            })
        })

        const tx = db.transaction("out-of-line", "readonly")
        const store = tx.objectStore("out-of-line")
        const result = await requestToPromise(store.getAllKeys("c"))

        expect(result).toEqual(["c"])
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
        const result = await requestToPromise(store.getAllKeys(3))

        expect(result).toEqual([3])
    })

    test("getAllKeys on empty object store", async ({ task }) => {
        const db = await createDatabase(task, (db) => {
            db.createObjectStore("empty")
        })

        const tx = db.transaction("empty", "readonly")
        const store = tx.objectStore("empty")
        const result = await requestToPromise(store.getAllKeys())

        expect(result).toEqual([])
    })

    test("Get all keys", async ({ task }) => {
        const db = await createDatabase(task, (db) => {
            const store = db.createObjectStore("out-of-line")
            alphabet.forEach((letter) => {
                store.put(`value-${letter}`, letter)
            })
        })

        const tx = db.transaction("out-of-line", "readonly")
        const store = tx.objectStore("out-of-line")
        const result = await requestToPromise(store.getAllKeys())

        expect(result).toEqual(alphabet)
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
        const result = await requestToPromise(store.getAllKeys(undefined, 10))

        expect(result).toHaveLength(10)
        expect(result).toEqual(alphabet.slice(0, 10))
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
            store.getAllKeys(IDBKeyRange.bound("g", "m")),
        )

        const expected = ["g", "h", "i", "j", "k", "l", "m"]
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
            store.getAllKeys(IDBKeyRange.bound("g", "m"), 3),
        )

        expect(result).toHaveLength(3)
        expect(result).toEqual(["g", "h", "i"])
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
            store.getAllKeys(IDBKeyRange.bound("g", "k", false, true)),
        )

        const expected = ["g", "h", "i", "j"]
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
            store.getAllKeys(IDBKeyRange.bound("g", "k", true, false)),
        )

        const expected = ["h", "i", "j", "k"]
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
            store.getAllKeys(IDBKeyRange.bound(4, 15), 3),
        )

        expect(result).toHaveLength(3)
        expect(result).toEqual([4, 5, 6])
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
        const result = await requestToPromise(store.getAllKeys("Doesn't exist"))

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
        const result = await requestToPromise(store.getAllKeys(undefined, 0))

        // count: 0 should behave the same as no count (return all records)
        expect(result).toEqual(alphabet)
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
            store.getAllKeys(undefined, 4294967295),
        )

        expect(result).toEqual(alphabet)
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
            store.getAllKeys(IDBKeyRange.upperBound("0")),
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
            store.getAllKeys(IDBKeyRange.lowerBound("zz")),
        )

        expect(result).toEqual([])
    })
})
