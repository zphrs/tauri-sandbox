import { describe, expect, test } from "vitest"
import { createDatabase, requestToPromise } from "../resources/createDatabase"
import { ConstraintError, DataError } from "../../inMemoryIdb/lib/errors"

// Port of w3c test: keygenerator.any.js
// Tests key generator functionality

describe("keygenerator", () => {
    function keyGeneratorTest(
        objects: (number | null)[],
        expectedKeys: number[],
        desc: string,
    ) {
        test(`Keygenerator - ${desc}`, async ({ task }) => {
            const db = await createDatabase(task, (db) => {
                const objStore = db.createObjectStore("store", {
                    keyPath: "id",
                    autoIncrement: true,
                })
                for (let i = 0; i < objects.length; i++) {
                    if (objects[i] === null) {
                        objStore.add({})
                    } else {
                        objStore.add({ id: objects[i] })
                    }
                }
            })

            const actualKeys: number[] = []
            const tx = db.transaction("store", "readonly")
            const store = tx.objectStore("store")
            const request = store.openCursor()

            await new Promise<void>((resolve, reject) => {
                request.onsuccess = () => {
                    try {
                        const cursor = request.result
                        if (cursor) {
                            actualKeys.push(cursor.key as number)
                            cursor.continue()
                        } else {
                            expect(actualKeys).toEqual(expectedKeys)
                            resolve()
                        }
                    } catch (error) {
                        reject(error)
                    }
                }
                request.onerror = () => reject(request.error)
            })
        })
    }

    keyGeneratorTest(
        [null, null, null, null],
        [1, 2, 3, 4],
        "starts at one, and increments by one",
    )

    keyGeneratorTest(
        [2, null, 5, null, 6.66, 7],
        [2, 3, 5, 6, 6.66, 7],
        "increments by one from last set key",
    )

    keyGeneratorTest(
        [
            -10,
            null,
            "6" as unknown as number,
            6.3,
            [10] as unknown as number,
            -2,
            4,
            null,
        ],
        [-10, -2, 1, 4, 6.3, 7, "6", [10]] as unknown as number[],
        "don't increment when new key is not bigger than current",
    )

    test("Keygenerator ConstraintError when using same id as already generated", async ({
        task,
    }) => {
        const objects = [1, null, { id: 2 }, null, 2.00001, 5, null, { id: 6 }]
        const expected = [1, 2, 2.00001, 3, 5, 6]
        let errors = 0

        const db = await createDatabase(task, (db) => {
            const objStore = db.createObjectStore("store", {
                keyPath: "id",
                autoIncrement: true,
            })

            for (let i = 0; i < objects.length; i++) {
                if (objects[i] === null) {
                    objStore.add({})
                } else if (typeof objects[i] === "object") {
                    const rq = objStore.add(objects[i])
                    rq.onerror = (e) => {
                        errors++
                        expect(rq.error?.name).toBe("ConstraintError")
                        e.preventDefault()
                        e.stopPropagation()
                    }
                    rq.onsuccess = () => {
                        expect.unreachable(
                            `Got rq.success when adding duplicate id ${objects[i]}`,
                        )
                    }
                } else {
                    objStore.add({ id: objects[i] })
                }
            }
        })

        const actualKeys: number[] = []
        const tx = db.transaction("store", "readonly")
        const store = tx.objectStore("store")
        const request = store.openCursor()

        await new Promise<void>((resolve, reject) => {
            request.onsuccess = () => {
                try {
                    const cursor = request.result
                    if (cursor) {
                        actualKeys.push(cursor.key as number)
                        cursor.continue()
                    } else {
                        expect(errors).toBe(2)
                        expect(actualKeys).toEqual(expected)
                        resolve()
                    }
                } catch (error) {
                    reject(error)
                }
            }
            request.onerror = () => reject(request.error)
        })
    })

    function bigKeyTest(key: number, description: string) {
        test(description, async ({ task }) => {
            expect(key).toBe(key) // Key is valid (not NaN)

            const db = await createDatabase(task, (db) => {
                db.createObjectStore("store", { autoIncrement: true })
            })

            const tx = db.transaction("store", "readwrite")
            const store = tx.objectStore("store")
            const value = 0

            // Initial put
            let result = await requestToPromise(store.put(value))
            expect(result).toBe(1)

            // Second put
            result = await requestToPromise(store.put(value))
            expect(result).toBe(2)

            // Explicit key
            result = await requestToPromise(store.put(value, 1000))
            expect(result).toBe(1000)

            // Key generator should have updated
            result = await requestToPromise(store.put(value))
            expect(result).toBe(1001)

            // Put with big key
            result = await requestToPromise(store.put(value, key))
            expect(result).toBe(key)

            if (key >= 0) {
                // Large positive values will max out the key generator
                try {
                    await requestToPromise(store.put(value))
                    expect.unreachable("put should fail")
                } catch (error) {
                    expect(error).toBeInstanceOf(ConstraintError)
                }
            } else {
                // Large negative values have no effect on the generator
                result = await requestToPromise(store.put(value))
                expect(result).toBe(1002)
            }
        })
    }

    // Test various large key values
    ;[
        {
            key: Number.MAX_SAFE_INTEGER + 1,
            description: "Key generator vs. explicit key 53 bits",
        },
        {
            key: Math.pow(2, 60),
            description:
                "Key generator vs. explicit key greater than 53 bits, less than 64 bits",
        },
        {
            key: -Math.pow(2, 60),
            description:
                "Key generator vs. explicit key greater than 53 bits, less than 64 bits (negative)",
        },
        {
            key: Math.pow(2, 63),
            description: "Key generator vs. explicit key 63 bits",
        },
        {
            key: -Math.pow(2, 63),
            description: "Key generator vs. explicit key 63 bits (negative)",
        },
        {
            key: Math.pow(2, 64),
            description: "Key generator vs. explicit key 64 bits",
        },
        {
            key: -Math.pow(2, 64),
            description: "Key generator vs. explicit key 64 bits (negative)",
        },
        {
            key: Math.pow(2, 70),
            description:
                "Key generator vs. explicit key greater than 64 bits, but still finite",
        },
        {
            key: -Math.pow(2, 70),
            description:
                "Key generator vs. explicit key greater than 64 bits, but still finite (negative)",
        },
        {
            key: Infinity,
            description: "Key generator vs. explicit key equal to Infinity",
        },
        {
            key: -Infinity,
            description: "Key generator vs. explicit key equal to -Infinity",
        },
    ].forEach((testCase) => {
        bigKeyTest(testCase.key, testCase.description)
    })

    test("Key is injected into value - single segment path", async ({
        task,
    }) => {
        const db = await createDatabase(task, (db) => {
            db.createObjectStore("store", {
                autoIncrement: true,
                keyPath: "id",
            })
        })

        const tx = db.transaction("store", "readwrite")
        const store = tx.objectStore("store")

        const key = await requestToPromise(store.put({ name: "n" }))
        expect(key).toBe(1)

        const value = await requestToPromise(store.get(key))
        expect(typeof value).toBe("object")
        expect(value.name).toBe("n")
        expect(value.id).toBe(key)
    })

    test("Key is injected into value - multi-segment path", async ({
        task,
    }) => {
        const db = await createDatabase(task, (db) => {
            db.createObjectStore("store", {
                autoIncrement: true,
                keyPath: "a.b.id",
            })
        })

        const tx = db.transaction("store", "readwrite")
        const store = tx.objectStore("store")

        const key = await requestToPromise(store.put({ name: "n" }))
        expect(key).toBe(1)

        const value = await requestToPromise(store.get(key))
        expect(typeof value).toBe("object")
        expect(value.name).toBe("n")
        expect(value.a.b.id).toBe(key)
    })

    test("Key is injected into value - multi-segment path, partially populated", async ({
        task,
    }) => {
        const db = await createDatabase(task, (db) => {
            db.createObjectStore("store", {
                autoIncrement: true,
                keyPath: "a.b.id",
            })
        })

        const tx = db.transaction("store", "readwrite")
        const store = tx.objectStore("store")

        const key = await requestToPromise(
            store.put({ name: "n1", b: { name: "n2" } }),
        )
        expect(key).toBe(1)

        const value = await requestToPromise(store.get(key))
        expect(typeof value).toBe("object")
        expect(value.name).toBe("n1")
        expect(value.b.name).toBe("n2")
        expect(value.a.b.id).toBe(key)
    })

    test("put() throws if key cannot be injected - single segment path", async ({
        task,
    }) => {
        const db = await createDatabase(task, (db) => {
            db.createObjectStore("store", {
                autoIncrement: true,
                keyPath: "id",
            })
        })

        const tx = db.transaction("store", "readwrite")
        const store = tx.objectStore("store")

        expect(() => {
            store.put(123)
        }).toThrow(DataError)
    })

    test("put() throws if key cannot be injected - multi-segment path", async ({
        task,
    }) => {
        const db = await createDatabase(task, (db) => {
            db.createObjectStore("store", {
                autoIncrement: true,
                keyPath: "a.b.id",
            })
        })

        const tx = db.transaction("store", "readwrite")
        const store = tx.objectStore("store")

        expect(() => {
            store.put({ a: 123 })
        }).toThrow(DataError)

        expect(() => {
            store.put({ a: { b: 123 } })
        }).toThrow(DataError)
    })

    test("Keygenerator overflow", async ({ task }) => {
        const objects = [9007199254740991, null, "error", 2, "error"]
        const expectedKeys = [2, 9007199254740991, 9007199254740992]
        let overflowErrorFired = false

        const db = await createDatabase(task, (db) => {
            const objStore = db.createObjectStore("store", {
                keyPath: "id",
                autoIncrement: true,
            })

            for (let i = 0; i < objects.length; i++) {
                if (objects[i] === null) {
                    objStore.add({})
                } else if (objects[i] === "error") {
                    const rq = objStore.add({})
                    rq.onsuccess = () => {
                        expect.unreachable(
                            'When "current number" overflows, error event is expected',
                        )
                    }
                    rq.onerror = (e) => {
                        overflowErrorFired = true
                        expect(rq.error?.name).toBe("ConstraintError")
                        e.preventDefault()
                        e.stopPropagation()
                    }
                } else {
                    objStore.add({ id: objects[i] })
                }
            }
        })

        const actualKeys: number[] = []
        const tx = db.transaction("store", "readonly")
        const store = tx.objectStore("store")
        const request = store.openCursor()

        await new Promise<void>((resolve, reject) => {
            request.onsuccess = () => {
                try {
                    const cursor = request.result
                    if (cursor) {
                        actualKeys.push(cursor.key as number)
                        cursor.continue()
                    } else {
                        expect(overflowErrorFired).toBe(true)
                        expect(actualKeys).toEqual(expectedKeys)
                        resolve()
                    }
                } catch (error) {
                    reject(error)
                }
            }
            request.onerror = () => reject(request.error)
        })
    })
})
