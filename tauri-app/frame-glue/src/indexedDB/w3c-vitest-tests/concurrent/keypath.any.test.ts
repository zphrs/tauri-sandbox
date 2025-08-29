import { describe, expect, test } from "vitest"
import { createDatabase } from "../resources/createDatabase"

// Port of w3c test: keypath.any.js
// Tests keypath functionality

describe("keypath", () => {
    async function testKeypath(
        keyPath: string | string[],
        objects: unknown[],
        expectedKeys: unknown[],
        task: { id?: string },
    ) {
        const db = await createDatabase(task, (db) => {
            const objStore = db.createObjectStore("store", { keyPath })
            for (let i = 0; i < objects.length; i++) {
                objStore.add(objects[i])
            }
        })

        const actualKeys: unknown[] = []
        const rq = db.transaction("store").objectStore("store").openCursor()

        await new Promise<void>((resolve, reject) => {
            rq.onsuccess = (e) => {
                const cursor = (e.target as IDBRequest).result as IDBCursorWithValue

                if (cursor) {
                    actualKeys.push(cursor.key.valueOf())
                    cursor.continue()
                } else {
                    try {
                        expect(actualKeys).toEqual(expectedKeys)
                        resolve()
                    } catch (error) {
                        reject(error)
                    }
                }
            }
            rq.onerror = () => reject(rq.error)
        })
    }

    test("my.key", async ({ task }) => {
        await testKeypath("my.key", [{ my: { key: 10 } }], [10], task)
    })

    test("my.køi", async ({ task }) => {
        await testKeypath("my.køi", [{ my: { køi: 5 } }], [5], task)
    })

    test("my.key_ya", async ({ task }) => {
        await testKeypath("my.key_ya", [{ my: { key_ya: 10 } }], [10], task)
    })

    test("public.key$ya", async ({ task }) => {
        await testKeypath("public.key$ya", [{ public: { key$ya: 10 } }], [10], task)
    })

    test("true.$", async ({ task }) => {
        await testKeypath("true.$", [{ true: { $: 10 } }], [10], task)
    })

    test("my._", async ({ task }) => {
        await testKeypath("my._", [{ my: { _: 10 } }], [10], task)
    })

    test("delete.a7", async ({ task }) => {
        await testKeypath("delete.a7", [{ delete: { a7: 10 } }], [10], task)
    })

    test("deeply nested keypath", async ({ task }) => {
        await testKeypath(
            "p.p.p.p.p.p.p.p.p.p.p.p.p.p",
            [
                {
                    p: {
                        p: {
                            p: {
                                p: {
                                    p: {
                                        p: {
                                            p: {
                                                p: {
                                                    p: {
                                                        p: {
                                                            p: { p: { p: { p: 10 } } },
                                                        },
                                                    },
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            ],
            [10],
            task,
        )
    })

    test("str.length", async ({ task }) => {
        await testKeypath(
            "str.length",
            [{ str: "pony" }, { str: "my" }, { str: "little" }, { str: "" }],
            [0, 2, 4, 6],
            task,
        )
    })

    test("arr.length", async ({ task }) => {
        await testKeypath(
            "arr.length",
            [
                { arr: [0, 0, 0, 0] },
                { arr: [{}, 0, "hei", "length", Infinity, []] },
                { arr: [10, 10] },
                { arr: [] },
            ],
            [0, 2, 4, 6],
            task,
        )
    })

    test("length", async ({ task }) => {
        await testKeypath("length", [[10, 10], "123", { length: 20 }], [2, 3, 20], task)
    })

    test("'' uses value as key", async ({ task }) => {
        await testKeypath(
            "",
            [["bags"], "bean", 10],
            [10, "bean", ["bags"]],
            task,
        )
    })

    test("[''] uses value as [key]", async ({ task }) => {
        await testKeypath(
            [""],
            [["bags"], "bean", 10],
            [[10], ["bean"], [["bags"]]],
            task,
        )
    })

    test("['x', 'y']", async ({ task }) => {
        await testKeypath(
            ["x", "y"],
            [
                { x: 10, y: 20 },
                { y: 1.337, x: 100 },
            ],
            [
                [10, 20],
                [100, 1.337],
            ],
            task,
        )
    })

    test("name and type", async ({ task }) => {
        await testKeypath(
            ["name", "type"],
            [
                { name: "orange", type: "fruit" },
                { name: "orange", type: ["telecom", "french"] },
            ],
            [
                ["orange", "fruit"],
                ["orange", ["telecom", "french"]],
            ],
            task,
        )
    })

    test("name and type.name", async ({ task }) => {
        await testKeypath(
            ["name", "type.name"],
            [
                { name: "orange", type: { name: "fruit" } },
                { name: "orange", type: { name: "telecom" } },
            ],
            [
                ["orange", "fruit"],
                ["orange", "telecom"],
            ],
            task,
        )
    })

    test("list with 1 field", async ({ task }) => {
        await testKeypath(
            ["type"],
            [
                { name: "orange", type: "fruit" },
                { name: "cucumber", type: "vegetable" },
            ],
            [["fruit"], ["vegetable"]],
            task,
        )
    })
})
