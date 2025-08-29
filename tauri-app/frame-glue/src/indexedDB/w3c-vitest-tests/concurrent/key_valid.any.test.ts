import { describe, expect, test } from "vitest"
import { createDatabase, requestToPromise } from "../resources/createDatabase"

// Port of w3c test: key_valid.any.js
// Tests valid key types

describe("key_valid", () => {
    const validKeyTest = (desc: string, key: IDBValidKey) => {
        test(`Valid key - ${desc}`, async ({ task }) => {
            const db = await createDatabase(task, (db) => {
                const store = db.createObjectStore("store")
                store.add("value", key)

                const store2 = db.createObjectStore("store2", {
                    keyPath: ["x", "keypath"],
                })
                store2.add({ x: "v", keypath: key })
            })

            const rq = db
                .transaction("store", "readonly")
                .objectStore("store")
                .get(key)
            const result = await requestToPromise(rq)
            expect(result).toBe("value")

            const rq2 = db
                .transaction("store2", "readonly")
                .objectStore("store2")
                .get(["v", key])
            const result2 = await requestToPromise(rq2)
            expect(result2.x).toBe("v")
            expect(result2.keypath).toEqual(key)
        })
    }

    // Date
    validKeyTest("new Date()", new Date())
    validKeyTest("new Date(0)", new Date(0))

    // Array
    validKeyTest("[]", [])
    validKeyTest("new Array()", [])

    validKeyTest('["undefined"]', ["undefined"])

    // Float
    validKeyTest("Infinity", Infinity)
    validKeyTest("-Infinity", -Infinity)
    validKeyTest("0", 0)
    validKeyTest("1.5", 1.5)
    validKeyTest("3e38", 3e38)
    validKeyTest("3e-38", 3e-38)

    // String
    validKeyTest('"foo"', "foo")
    validKeyTest('"\\n"', "\n")
    validKeyTest('""', "")
    validKeyTest('"\\""', '"')
    validKeyTest('"\\u1234"', "\u1234")
    validKeyTest('"\\u0000"', "\u0000")
    validKeyTest('"NaN"', "NaN")
})
