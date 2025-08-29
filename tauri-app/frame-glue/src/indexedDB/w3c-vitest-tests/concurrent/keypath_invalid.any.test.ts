import { describe, expect, test } from "vitest"
import { createDatabase } from "../resources/createDatabase"

// Port of w3c test: keypath_invalid.any.js
// Tests invalid keypath handling

describe("keypath_invalid", () => {
    async function testInvalidKeypath(keypath: unknown, task?: { id?: string }) {
        await createDatabase(task!, (db) => {
            expect(() => {
                db.createObjectStore("store", { keyPath: keypath as string })
            }).toThrow()

            const store = db.createObjectStore("store2")
            expect(() => {
                store.createIndex("index", keypath as string)
            }).toThrow()
        })
    }

    test("j a", async ({ task }) => {
        await testInvalidKeypath("j a", task)
    })

    test(".yo", async ({ task }) => {
        await testInvalidKeypath(".yo", task)
    })

    test("yo,lo", async ({ task }) => {
        await testInvalidKeypath("yo,lo", task)
    })

    test("empty array", async ({ task }) => {
        await testInvalidKeypath([], task)
    })

    test("array with space", async ({ task }) => {
        await testInvalidKeypath(["array with space"], task)
    })

    test("multidimensional array (invalid toString)", async ({ task }) => {
        await testInvalidKeypath(["multi_array", ["a", "b"]], task)
    })

    test("3m", async ({ task }) => {
        await testInvalidKeypath("3m", task)
    })

    test("{toString->3m}", async ({ task }) => {
        await testInvalidKeypath({
            toString: function () {
                return "3m"
            },
        }, task)
    })

    test("my.1337", async ({ task }) => {
        await testInvalidKeypath("my.1337", task)
    })

    test("..yo", async ({ task }) => {
        await testInvalidKeypath("..yo", task)
    })

    test("y..o", async ({ task }) => {
        await testInvalidKeypath("y..o", task)
    })

    test("y.o.", async ({ task }) => {
        await testInvalidKeypath("y.o.", task)
    })

    test("y.o..", async ({ task }) => {
        await testInvalidKeypath("y.o..", task)
    })

    test("m.*", async ({ task }) => {
        await testInvalidKeypath("m.*", task)
    })

    test('"m"', async ({ task }) => {
        await testInvalidKeypath('"m"', task)
    })

    test("m%", async ({ task }) => {
        await testInvalidKeypath("m%", task)
    })

    test("m/", async ({ task }) => {
        await testInvalidKeypath("m/", task)
    })

    test("m/a", async ({ task }) => {
        await testInvalidKeypath("m/a", task)
    })

    test("m&", async ({ task }) => {
        await testInvalidKeypath("m&", task)
    })

    test("m!", async ({ task }) => {
        await testInvalidKeypath("m!", task)
    })

    test("*", async ({ task }) => {
        await testInvalidKeypath("*", task)
    })

    test("*.*", async ({ task }) => {
        await testInvalidKeypath("*.*", task)
    })

    test("^m", async ({ task }) => {
        await testInvalidKeypath("^m", task)
    })

    test("/m/", async ({ task }) => {
        await testInvalidKeypath("/m/", task)
    })
})
