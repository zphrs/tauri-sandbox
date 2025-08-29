import { describe, expect, test } from "vitest"
import { createDatabase, requestToPromise } from "../resources/createDatabase"
import { DataError } from "../../inMemoryIdb/lib/errors"

// Port of w3c test: keypath-exceptions.any.js
// Tests exceptions in extracting keys from values (ES bindings)

describe("keypath-exceptions", () => {
    test("The last element of keypath is validated", async ({ task }) => {
        const db = await createDatabase(task, (db) => {
            db.createObjectStore("store", {
                autoIncrement: true,
                keyPath: "a.b.c",
            })
        })

        const tx = db.transaction("store", "readwrite")
        expect(() => {
            tx.objectStore("store").put({ a: { b: "foo" } })
        }).toThrow(DataError)
    })

    test("Key path evaluation: Exceptions from non-enumerable getters", async ({
        task,
    }) => {
        const err = new Error()
        err.name = "getter"

        function throwingGetter() {
            throw err
        }

        await createDatabase(task, (db) => {
            const o = {}
            Object.defineProperty(o, "throws", {
                get: throwingGetter,
                enumerable: false,
                configurable: true,
            })

            // Value should be cloned before key path is evaluated,
            // and non-enumerable getter will be ignored. The clone
            // will have no such property, so key path evaluation
            // will fail.
            const s1 = db.createObjectStore("s1", { keyPath: "throws" })
            expect(() => {
                s1.put(o)
            }).toThrow(DataError)

            // Value should be cloned before key path is evaluated,
            // and non-enumerable getter will be ignored. The clone
            // will have no such property, so key path evaluation
            // will fail.
            const s2 = db.createObjectStore("s2", { keyPath: "throws.x" })
            expect(() => {
                s2.put(o)
            }).toThrow(DataError)

            // Value should be cloned before key path is evaluated,
            // and non-enumerable getter will be ignored. The clone
            // will have no such property, so generated key can be
            // inserted.
            const s3 = db.createObjectStore("s3", {
                keyPath: "throws",
                autoIncrement: true,
            })
            const req3 = s3.put(o)
            expect(req3.constructor.name).toBe("FDBRequest")

            // Value should be cloned before key path is evaluated,
            // and non-enumerable getter will be ignored. The clone
            // will have no such property, so intermediate object
            // and generated key can be inserted.
            const s4 = db.createObjectStore("s4", {
                keyPath: "throws.x",
                autoIncrement: true,
            })
            const req4 = s4.put(o)
            expect(req4.constructor.name).toBe("FDBRequest")
        })
    })

    test("Key path evaluation: Exceptions from enumerable getters", async ({
        task,
    }) => {
        const err = new Error()
        err.name = "getter"

        function throwingGetter() {
            throw err
        }

        await createDatabase(task, (db) => {
            const o = {}
            Object.defineProperty(o, "throws", {
                get: throwingGetter,
                enumerable: true,
                configurable: true,
            })

            // Value should be cloned before key path is evaluated,
            // and enumerable getter will rethrow.
            const s1 = db.createObjectStore("s1", { keyPath: "throws" })
            expect(() => {
                s1.put(o)
            }).toThrow(err)

            // Value should be cloned before key path is evaluated,
            // and enumerable getter will rethrow.
            const s2 = db.createObjectStore("s2", { keyPath: "throws.x" })
            expect(() => {
                s2.put(o)
            }).toThrow(err)

            // Value should be cloned before key path is evaluated,
            // and enumerable getter will rethrow.
            const s3 = db.createObjectStore("s3", {
                keyPath: "throws",
                autoIncrement: true,
            })
            expect(() => {
                s3.put(o)
            }).toThrow(err)

            // Value should be cloned before key path is evaluated,
            // and enumerable getter will rethrow.
            const s4 = db.createObjectStore("s4", {
                keyPath: "throws.x",
                autoIncrement: true,
            })
            expect(() => {
                s4.put(o)
            }).toThrow(err)
        })
    })
    // cant pass with prototype overriding because the clone is created within
    // this js environment which has the property overridden
    test.skip("Key path evaluation: Exceptions from non-enumerable getters on prototype", async ({
        task,
    }) => {
        const err = new Error()
        err.name = "getter"

        function throwingGetter() {
            throw err
        }

        await createDatabase(task, (db) => {
            // Implemented as function wrapper to clean up
            // immediately after use, otherwise it may
            // interfere with the test harness.
            function with_proto_getter(f: () => void) {
                return function () {
                    Object.defineProperty(Object.prototype, "throws", {
                        get: throwingGetter,
                        enumerable: false,
                        configurable: true,
                    })
                    try {
                        f()
                    } finally {
                        delete (Object.prototype as Record<string, unknown>)[
                            "throws"
                        ]
                    }
                }
            }

            // Value should be cloned before key path is evaluated,
            // and non-enumerable getter will be ignored. The clone
            // will have no own property, so key path evaluation will
            // fail and DataError should be thrown.
            const s1 = db.createObjectStore("s1", { keyPath: "throws" })
            expect(
                with_proto_getter(function () {
                    s1.put({})
                }),
            ).toThrow(DataError)

            // Value should be cloned before key path is evaluated,
            // and non-enumerable getter will be ignored. The clone
            // will have no own property, so key path evaluation will
            // fail and DataError should be thrown.
            const s2 = db.createObjectStore("s2", { keyPath: "throws.x" })
            expect(
                with_proto_getter(function () {
                    s2.put({})
                }),
            ).toThrow(DataError)

            // Value should be cloned before key path is evaluated,
            // and non-enumerable getter will be ignored. The clone
            // will have no own property, so key path evaluation will
            // fail and injection can succeed.
            const s3 = db.createObjectStore("s3", {
                keyPath: "throws",
                autoIncrement: true,
            })
            let request3: IDBRequest
            with_proto_getter(() => {
                request3 = s3.put({})
            })()
            expect(request3!.readyState).toBe("pending")

            // Value should be cloned before key path is evaluated,
            // and non-enumerable getter will be ignored. The clone
            // will have no own property, so key path evaluation will
            // fail and injection can succeed.
            const s4 = db.createObjectStore("s4", {
                keyPath: "throws.x",
                autoIncrement: true,
            })
            let request4: IDBRequest
            with_proto_getter(() => {
                request4 = s4.put({})
            })()
            expect(request4!.readyState).toBe("pending")
        })
    })
    // cant pass with prototype overriding because the clone is created within
    // this js environment which has the property overridden
    test.skip("Key path evaluation: Exceptions from enumerable getters on prototype", async ({
        task,
    }) => {
        const err = new Error()
        err.name = "getter"

        function throwingGetter() {
            throw err
        }

        await createDatabase(task, (db) => {
            // Implemented as function wrapper to clean up
            // immediately after use, otherwise it may
            // interfere with the test harness.
            function with_proto_getter(f: () => void) {
                return () => {
                    Object.defineProperty(Object.prototype, "throws", {
                        get: throwingGetter,
                        enumerable: true,
                        configurable: true,
                    })
                    try {
                        f()
                    } finally {
                        delete (Object.prototype as Record<string, unknown>)[
                            "throws"
                        ]
                    }
                }
            }

            // Value should be cloned before key path is evaluated.
            // The clone will have no own property, so key path
            // evaluation will fail and DataError should be thrown.
            const s1 = db.createObjectStore("s1", { keyPath: "throws" })
            expect(
                with_proto_getter(function () {
                    s1.put({})
                }),
            ).toThrow(DataError)

            // Value should be cloned before key path is evaluated.
            // The clone will have no own property, so key path
            // evaluation will fail and DataError should be thrown.
            const s2 = db.createObjectStore("s2", { keyPath: "throws.x" })
            expect(
                with_proto_getter(function () {
                    s2.put({})
                }),
            ).toThrow(DataError)

            // Value should be cloned before key path is evaluated.
            // The clone will have no own property, so key path
            // evaluation will fail and injection can succeed.
            const s3 = db.createObjectStore("s3", {
                keyPath: "throws",
                autoIncrement: true,
            })
            let request3: IDBRequest
            with_proto_getter(() => {
                request3 = s3.put({})
            })()
            expect(request3!.readyState).toBe("pending")

            // Value should be cloned before key path is evaluated.
            // The clone will have no own property, so key path
            // evaluation will fail and injection can succeed.
            const s4 = db.createObjectStore("s4", {
                keyPath: "throws.x",
                autoIncrement: true,
            })
            let request4: IDBRequest
            with_proto_getter(() => {
                request4 = s4.put({})
            })()
            expect(request4!.readyState).toBe("pending")
        })
    })

    test("Array key conversion should not invoke prototype getters", async ({
        task,
    }) => {
        const db = await createDatabase(task, (db) => {
            const store = db.createObjectStore("store")
            store.createIndex("index", "index0")
        })

        const tx = db.transaction("store", "readwrite")

        const array: unknown[] = []
        array[99] = 1

        // Implemented as function wrapper to clean up
        // immediately after use, otherwise it may
        // interfere with the test harness.
        let getter_called = 0
        function with_proto_getter<T>(f: () => T): T {
            const prop = "50"
            Object.defineProperty(Object.prototype, prop, {
                enumerable: true,
                configurable: true,
                get: () => {
                    ++getter_called
                    return "foo"
                },
            })
            try {
                return f()
            } finally {
                delete (Object.prototype as Record<string, unknown>)[prop]
            }
        }

        const request = with_proto_getter(() =>
            tx.objectStore("store").put({ index0: array }, "key"),
        )

        await requestToPromise(request)
        expect(getter_called).toBe(0)
    })
})
