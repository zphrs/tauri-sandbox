import { describe, test, expect } from "vitest"
import { createDatabase, requestToPromise } from "../resources/createDatabase"

// Port of w3c test: clone-before-keypath-eval.any.js
// Tests that key path evaluation operates on cloned objects
describe("clone-before-keypath-eval", () => {
    class ProbeObject {
        id_count = 0
        invalid_id_count = 0
        prop_count = 0

        constructor() {
            Object.defineProperties(this, {
                id: {
                    enumerable: true,
                    get() {
                        ++this.id_count
                        return 1000 + this.id_count
                    },
                },
                invalid_id: {
                    enumerable: true,
                    get() {
                        ++this.invalid_id_count
                        return {}
                    },
                },
                prop: {
                    enumerable: true,
                    get() {
                        ++this.prop_count
                        return 2000 + this.prop_count
                    },
                },
            })
        }
    }

    function createTransactionAndReturnObjectStore(
        db: IDBDatabase,
        storeName: string,
    ) {
        const tx = db.transaction(storeName, "readwrite")
        const store = tx.objectStore(storeName)
        return { tx, store }
    }

    test("Key generator and key path validity check operates on a clone", async ({
        task,
    }) => {
        const db = await createDatabase(task, (db) => {
            db.createObjectStore("store", {
                keyPath: "id",
                autoIncrement: true,
            })
        })

        const { store } = createTransactionAndReturnObjectStore(db, "store")
        const obj = new ProbeObject()

        await requestToPromise(store.put(obj))

        expect(obj.id_count).toBe(1)
        expect(obj.prop_count).toBe(1)
    })

    test("Failing key path validity check operates on a clone", async ({
        task,
    }) => {
        const db = await createDatabase(task, (db) => {
            db.createObjectStore("store", {
                keyPath: "invalid_id",
                autoIncrement: true,
            })
        })

        const { store } = createTransactionAndReturnObjectStore(db, "store")
        const obj = new ProbeObject()

        await expect(async () => {
            await requestToPromise(store.put(obj))
        }).rejects.toThrow()

        expect(obj.invalid_id_count).toBe(1)
        expect(obj.prop_count).toBe(1)
    })

    test("Index key path evaluations operate on a clone", async ({ task }) => {
        const db = await createDatabase(task, (db) => {
            const store = db.createObjectStore("store")
            store.createIndex("index", "prop")
        })

        const { store } = createTransactionAndReturnObjectStore(db, "store")
        const obj = new ProbeObject()

        await requestToPromise(store.put(obj, "key"))

        expect(obj.prop_count).toBe(1)
        expect(obj.id_count).toBe(1)
    })

    test("Store and index key path evaluations operate on the same clone", async ({
        task,
    }) => {
        const db = await createDatabase(task, (db) => {
            const store = db.createObjectStore("store", { keyPath: "id" })
            store.createIndex("index", "prop")
        })

        const { store } = createTransactionAndReturnObjectStore(db, "store")
        const obj = new ProbeObject()

        await requestToPromise(store.put(obj))

        expect(obj.id_count).toBe(1)
        expect(obj.prop_count).toBe(1)
    })

    test("Cursor update checks and keypath evaluations operate on a clone", async ({
        task,
    }) => {
        const db = await createDatabase(task, (db) => {
            const store = db.createObjectStore("store", { keyPath: "id" })
            store.createIndex("index", "prop")
        })

        const { store } = createTransactionAndReturnObjectStore(db, "store")
        await requestToPromise(store.put(new ProbeObject()))

        const cursor = await requestToPromise(store.openCursor())
        expect(cursor).not.toBeNull()

        const obj = new ProbeObject()
        await requestToPromise(cursor!.update(obj))

        expect(obj.id_count).toBe(1)
        expect(obj.prop_count).toBe(1)
    })
})
