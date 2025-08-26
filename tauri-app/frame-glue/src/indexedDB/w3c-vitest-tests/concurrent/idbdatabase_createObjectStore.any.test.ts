import { describe, expect, test } from "vitest"
import { createDatabase, requestToPromise } from "../resources/createDatabase"
import { FDBObjectStore } from "../../inMemoryIdb"
import {
    ConstraintError,
    InvalidStateError,
    InvalidAccessError,
} from "../../inMemoryIdb/lib/errors"

// Port of w3c test: idbdatabase_createObjectStore.any.js
// Tests IDBDatabase.createObjectStore() method functionality

describe("IDBDatabase.createObjectStore()", () => {
    test("Both with empty name", async ({ task }) => {
        const db = await createDatabase(task, (db) => {
            const store = db.createObjectStore("")

            for (let i = 0; i < 5; i++) {
                store.add({ idx: "object_" + i }, i)
            }

            store.createIndex("", "idx")
        })

        const tx = db.transaction("", "readonly")
        const store = tx.objectStore("")

        expect(store.indexNames[0]).toBe("")
        expect(store.indexNames.length).toBe(1)

        const result = await requestToPromise(store.index("").get("object_4"))
        expect(result.idx).toBe("object_4")
    })

    test("Returns an instance of IDBObjectStore", async ({ task }) => {
        const db = await createDatabase(task, (db) => {
            const objStore = db.createObjectStore("instancetest")
            expect(objStore).toBeInstanceOf(FDBObjectStore)
        })

        const objStore = db
            .transaction("instancetest", "readonly")
            .objectStore("instancetest")
        expect(objStore).toBeInstanceOf(FDBObjectStore)
    })

    test("Create 1000 object stores, add one item and delete", async ({
        task,
    }) => {
        const db = await createDatabase(task, (db) => {
            let store
            for (let i = 0; i < 1000; i++) {
                store = db.createObjectStore("object_store_" + i)
                store.add("test", 1)
            }
        })

        // Test that we can retrieve from the last store
        const tx = db.transaction("object_store_999", "readonly")
        const store = tx.objectStore("object_store_999")
        const result = await requestToPromise(store.get(1))
        expect(result).toBe("test")
    })

    test("Empty name", async ({ task }) => {
        const db = await createDatabase(task, (db) => {
            const store = db.createObjectStore("")

            for (let i = 0; i < 5; i++) {
                store.add("object_" + i, i)
            }

            expect(db.objectStoreNames[0]).toBe("")
            expect(db.objectStoreNames.length).toBe(1)
        })

        const store = db.transaction("").objectStore("")
        const result = await requestToPromise(store.get(2))
        expect(result).toBe("object_2")

        expect(db.objectStoreNames[0]).toBe("")
        expect(db.objectStoreNames.length).toBe(1)
    })

    test("Attempting to create an existing object store with a different keyPath throw ConstraintError", async ({
        task,
    }) => {
        await createDatabase(task, (db) => {
            db.createObjectStore("store")
            expect(() => {
                db.createObjectStore("store", {
                    keyPath: "key1",
                })
            }).toThrow(ConstraintError)
        })
    })

    test("Object store 'name' and 'keyPath' properties are correctly set", async ({
        task,
    }) => {
        const db = await createDatabase(task, (db) => {
            const objStore = db.createObjectStore("prop", {
                keyPath: "mykeypath",
            })

            expect(objStore.name).toBe("prop")
            expect(objStore.keyPath).toBe("mykeypath")
            expect(objStore.autoIncrement).toBe(false)
        })

        const objStore = db.transaction("prop", "readonly").objectStore("prop")
        expect(objStore.name).toBe("prop")
        expect(objStore.keyPath).toBe("mykeypath")
        expect(objStore.autoIncrement).toBe(false)
    })

    test("Attempt to create an object store outside of a version change transaction", async ({
        task,
    }) => {
        const db = await createDatabase(task, () => {})

        expect(() => {
            db.createObjectStore("fails")
        }).toThrow(InvalidStateError)
    })

    test("Attempt to create an object store that already exists", async ({
        task,
    }) => {
        await createDatabase(task, (db) => {
            db.createObjectStore("dupe")
            expect(() => {
                db.createObjectStore("dupe")
            }).toThrow(ConstraintError)

            // Bonus test creating a new objectstore after the exception
            db.createObjectStore("dupe ")
        })
    })

    test("Object store's name appears in database's list", async ({ task }) => {
        const db = await createDatabase(task, (db) => {
            db.createObjectStore("My cool object store name")
            expect(
                db.objectStoreNames.contains("My cool object store name"),
            ).toBe(true)
        })

        expect(db.objectStoreNames.contains("My cool object store name")).toBe(
            true,
        )
    })

    test("Attempt to create an object store with an invalid key path", async ({
        task,
    }) => {
        let errorThrown = false
        let error2Thrown = false

        await createDatabase(task, (db) => {
            try {
                db.createObjectStore("invalidkeypath", {
                    keyPath: "Invalid Keypath",
                })
            } catch (err) {
                errorThrown = true
                expect((err as Error).name).toBe("SyntaxError")
            }

            try {
                db.createObjectStore("invalidkeypath2", {
                    autoIncrement: true,
                    keyPath: "Invalid Keypath",
                })
            } catch (err) {
                error2Thrown = true
                expect((err as Error).name).toBe("SyntaxError")
            }
        })

        expect(errorThrown).toBe(true)
        expect(error2Thrown).toBe(true)
    })

    test("Create an object store with an unknown optional parameter", async ({
        task,
    }) => {
        await createDatabase(task, (db) => {
            // This should not throw
            db.createObjectStore("with unknown param", {
                parameter: 0,
            } as IDBObjectStoreParameters & { parameter: number })
        })
    })

    // Test various valid optional parameters
    describe("Valid optional parameters", () => {
        test("autoInc true", async ({ task }) => {
            await createDatabase(task, (db) => {
                db.createObjectStore("store", { autoIncrement: true })
            })
        })

        test("autoInc true, keyPath null", async ({ task }) => {
            await createDatabase(task, (db) => {
                db.createObjectStore("store", {
                    autoIncrement: true,
                    keyPath: null,
                })
            })
        })

        test("autoInc true, keyPath undefined", async ({ task }) => {
            await createDatabase(task, (db) => {
                db.createObjectStore("store", {
                    autoIncrement: true,
                    keyPath: undefined,
                })
            })
        })

        test("autoInc true, keyPath string", async ({ task }) => {
            await createDatabase(task, (db) => {
                db.createObjectStore("store", {
                    autoIncrement: true,
                    keyPath: "a",
                })
            })
        })

        test("autoInc false, keyPath empty", async ({ task }) => {
            await createDatabase(task, (db) => {
                db.createObjectStore("store", {
                    autoIncrement: false,
                    keyPath: "",
                })
            })
        })

        test("autoInc false, keyPath array", async ({ task }) => {
            await createDatabase(task, (db) => {
                db.createObjectStore("store", {
                    autoIncrement: false,
                    keyPath: ["h", "j"],
                })
            })
        })

        test("autoInc false, keyPath string", async ({ task }) => {
            await createDatabase(task, (db) => {
                db.createObjectStore("store", {
                    autoIncrement: false,
                    keyPath: "abc",
                })
            })
        })

        test("keyPath empty", async ({ task }) => {
            await createDatabase(task, (db) => {
                db.createObjectStore("store", { keyPath: "" })
            })
        })

        test("keyPath array", async ({ task }) => {
            await createDatabase(task, (db) => {
                db.createObjectStore("store", { keyPath: ["a", "b"] })
            })
        })

        test("keyPath string", async ({ task }) => {
            await createDatabase(task, (db) => {
                db.createObjectStore("store", { keyPath: "abc" })
            })
        })

        test("keyPath null", async ({ task }) => {
            await createDatabase(task, (db) => {
                db.createObjectStore("store", { keyPath: null })
            })
        })

        test("keyPath undefined", async ({ task }) => {
            await createDatabase(task, (db) => {
                db.createObjectStore("store", { keyPath: undefined })
            })
        })
    })

    // Test invalid optional parameters
    describe("Invalid optional parameters", () => {
        test("autoInc and empty keyPath", async ({ task }) => {
            await createDatabase(task, (db) => {
                expect(() => {
                    db.createObjectStore("store", {
                        autoIncrement: true,
                        keyPath: "",
                    })
                }).toThrow(InvalidAccessError)
            })
        })

        test("autoInc and keyPath array", async ({ task }) => {
            let errorThrown = false

            await createDatabase(task, (db) => {
                try {
                    db.createObjectStore("store", {
                        autoIncrement: true,
                        keyPath: [],
                    })
                } catch (err) {
                    errorThrown = true
                    expect((err as Error).name).toBe("SyntaxError")
                }
            })

            expect(errorThrown).toBe(true)
        })

        test("autoInc and keyPath array 2", async ({ task }) => {
            await createDatabase(task, (db) => {
                expect(() => {
                    db.createObjectStore("store", {
                        autoIncrement: true,
                        keyPath: ["hey"],
                    })
                }).toThrow(InvalidAccessError)
            })
        })

        test("autoInc and keyPath object", async ({ task }) => {
            let errorThrown = false

            await createDatabase(task, (db) => {
                try {
                    db.createObjectStore("store", {
                        autoIncrement: true,
                        keyPath: { a: "hey", b: 2 } as unknown as string,
                    })
                } catch (err) {
                    errorThrown = true
                    expect((err as Error).name).toBe("SyntaxError")
                }
            })

            expect(errorThrown).toBe(true)
        })
    })
})
