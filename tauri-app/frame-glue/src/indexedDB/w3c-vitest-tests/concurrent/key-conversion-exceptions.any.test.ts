import { describe, expect, test } from "vitest"
import { createDatabase, idb } from "../resources/createDatabase"
import { FDBKeyRange as IDBKeyRange } from "../../inMemoryIdb"
import { DataError } from "../../inMemoryIdb/lib/errors"

// Port of w3c test: key-conversion-exceptions.any.js
// Tests exceptions thrown during key conversion

// Key that throws during conversion
function throwingKey(name: string): [unknown[], Error] {
    const throws: unknown[] = []
    throws.length = 1
    const err = new Error("throwing from getter")
    err.name = name
    Object.defineProperty(throws, "0", {
        get: function () {
            throw err
        },
        enumerable: true,
    })
    return [throws, err]
}

const validKey: unknown[] = []
const invalidKey = {}

// Calls method on receiver with the specified number of args (default 1)
// and asserts that the method fails appropriately (rethrowing if
// conversion throws, or DataError if not a valid key), and that
// the first argument is fully processed before the second argument
// (if appropriate).
function checkMethod(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    receiver: any,
    method: string,
    args: number = 1,
): void {
    if (args < 2) {
        const [key, err] = throwingKey("getter")
        expect(() => {
            receiver[method](key)
        }).toThrow(err)

        expect(() => {
            receiver[method](invalidKey)
        }).toThrow(DataError)
    } else {
        const [key1, err1] = throwingKey("getter 1")
        const [key2, err2] = throwingKey("getter 2")
        expect(() => {
            receiver[method](key1, key2)
        }).toThrow(err1)

        expect(() => {
            receiver[method](invalidKey, key2)
        }).toThrow(DataError)

        expect(() => {
            receiver[method](validKey, key2)
        }).toThrow(err2)

        expect(() => {
            receiver[method](validKey, invalidKey)
        }).toThrow(DataError)
    }
}

describe("key-conversion-exceptions", () => {
    // Static key comparison utility on IDBFactory.
    test("IDBFactory cmp() static with throwing/invalid keys", () => {
        checkMethod(idb, "cmp", 2)
    })

    // Continue methods on IDBCursor.
    test("IDBCursor continue() method with throwing/invalid keys", async ({
        task,
    }) => {
        const db = await createDatabase(task, (db) => {
            const store = db.createObjectStore("store")
            store.put("a", 1)
        })

        const tx = db.transaction("store", "readonly")
        const store = tx.objectStore("store")
        const request = store.openCursor()

        await new Promise<void>((resolve, reject) => {
            request.onsuccess = () => {
                try {
                    const cursor = request.result
                    expect(cursor).not.toBe(null)
                    checkMethod(cursor, "continue")
                    resolve()
                } catch (e) {
                    reject(e)
                }
            }
            request.onerror = () => reject(request.error)
        })
    })

    test("IDBCursor continuePrimaryKey() method with throwing/invalid keys", async ({
        task,
    }) => {
        const db = await createDatabase(task, (db) => {
            const store = db.createObjectStore("store")
            store.createIndex("index", "prop")
            store.put({ prop: "a" }, 1)
        })

        const tx = db.transaction("store", "readonly")
        const store = tx.objectStore("store")
        const index = store.index("index")
        const request = index.openCursor()

        await new Promise<void>((resolve, reject) => {
            request.onsuccess = () => {
                try {
                    const cursor = request.result
                    expect(cursor).not.toBe(null)
                    checkMethod(cursor, "continuePrimaryKey", 2)
                    resolve()
                } catch (e) {
                    reject(e)
                }
            }
            request.onerror = () => reject(request.error)
        })
    })

    // Mutation methods on IDBCursor.
    test("IDBCursor update() method with throwing/invalid keys", async ({
        task,
    }) => {
        const db = await createDatabase(task, (db) => {
            const store = db.createObjectStore("store", { keyPath: "prop" })
            store.put({ prop: 1 })
        })

        const tx = db.transaction("store", "readwrite")
        const store = tx.objectStore("store")
        const request = store.openCursor()

        await new Promise<void>((resolve, reject) => {
            request.onsuccess = () => {
                try {
                    const cursor = request.result
                    expect(cursor).not.toBe(null)

                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const value: any = {}
                    ;[value.prop] = throwingKey("getter")
                    expect(() => {
                        cursor!.update(value)
                    }).toThrow(DataError)

                    // Throwing from the getter during key conversion is
                    // not possible since (1) a clone is used, (2) only own
                    // properties are cloned, and (3) only own properties
                    // are used for key path evaluation.

                    value.prop = invalidKey
                    expect(() => {
                        cursor!.update(value)
                    }).toThrow(DataError)

                    resolve()
                } catch (e) {
                    reject(e)
                }
            }
            request.onerror = () => reject(request.error)
        })
    })

    // Static constructors on IDBKeyRange
    ;["only", "lowerBound", "upperBound"].forEach((method) => {
        test(`IDBKeyRange ${method}() static with throwing/invalid keys`, () => {
            checkMethod(IDBKeyRange, method)
        })
    })

    test("IDBKeyRange bound() static with throwing/invalid keys", () => {
        checkMethod(IDBKeyRange, "bound", 2)
    })

    // Insertion methods on IDBObjectStore.
    ;(["add", "put"] as const).forEach((method) => {
        test(`IDBObjectStore ${method}() method with throwing/invalid keys`, async ({
            task,
        }) => {
            const db = await createDatabase(task, (db) => {
                db.createObjectStore("out-of-line keys")
                db.createObjectStore("in-line keys", {
                    keyPath: "prop",
                })
            })

            const tx = db.transaction(
                ["out-of-line keys", "in-line keys"],
                "readwrite",
            )
            const outOfLine = tx.objectStore("out-of-line keys")
            const inLine = tx.objectStore("in-line keys")

            const [key, err] = throwingKey("getter")
            expect(() => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                ;(outOfLine as any)[method]("value", key)
            }).toThrow(err)

            expect(() => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                ;(outOfLine as any)[method]("value", invalidKey)
            }).toThrow(DataError)

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const value: any = {}
            let err2: Error
            ;[value.prop, err2] = throwingKey("getter")
            expect(() => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                ;(inLine as any)[method](value)
            }).toThrow(err2)

            // Throwing from the getter during key conversion is
            // not possible since (1) a clone is used, (2) only own
            // properties are cloned, and (3) only own properties
            // are used for key path evaluation.

            value.prop = invalidKey
            expect(() => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                ;(inLine as any)[method](value)
            }).toThrow(DataError)
        })
    })

    // Generic (key-or-key-path) methods on IDBObjectStore.
    ;[
        "delete",
        "get",
        "getKey",
        "count",
        "openCursor",
        "openKeyCursor",
    ].forEach((method) => {
        test(`IDBObjectStore ${method}() method with throwing/invalid keys`, async ({
            task,
        }) => {
            const db = await createDatabase(task, (db) => {
                db.createObjectStore("store")
            })

            const tx = db.transaction("store", "readwrite")
            const store = tx.objectStore("store")

            checkMethod(store, method)
        })
    })

    // Generic (key-or-key-path) methods on IDBIndex.
    ;["get", "getKey", "count", "openCursor", "openKeyCursor"].forEach(
        (method) => {
            test(`IDBIndex ${method}() method with throwing/invalid keys`, async ({
                task,
            }) => {
                const db = await createDatabase(task, (db) => {
                    const store = db.createObjectStore("store")
                    store.createIndex("index", "keyPath")
                })

                const tx = db.transaction("store", "readonly")
                const store = tx.objectStore("store")
                const index = store.index("index")

                checkMethod(index, method)
            })
        },
    )

    // Verify methods that take `IDBGetAllOptions` on `IDBObjectStore`.
    ;["getAll", "getAllKeys"].forEach((method) => {
        test(`IDBObjectStore ${method}() method with throwing/invalid keys`, async ({
            task,
        }) => {
            const db = await createDatabase(task, (db) => {
                db.createObjectStore("store")
            })

            const tx = db.transaction("store", "readonly")
            const store = tx.objectStore("store")

            // This browser does not support `getAllRecords()` or the
            // `IDBGetAllOptions` dictionary, so just test the basic method
            checkMethod(store, method)
        })
    })

    // Verify methods that take `IDBGetAllOptions` on `IDBIndex`.
    ;["getAll", "getAllKeys"].forEach((method) => {
        test(`IDBIndex ${method}() method with throwing/invalid keys`, async ({
            task,
        }) => {
            const db = await createDatabase(task, (db) => {
                const store = db.createObjectStore("store")
                store.createIndex("index", "keyPath")
            })

            const tx = db.transaction("store", "readonly")
            const store = tx.objectStore("store")
            const index = store.index("index")

            checkMethod(index, method)
        })
    })
})
