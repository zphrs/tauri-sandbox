import { describe, test, expect } from "vitest"
import { createDatabase } from "../resources/createDatabase"

// Port of w3c test: idbobjectstore-request-source.any.js
// Tests the source of requests made against object stores

describe("IDBObjectStore request source", () => {
    const testMethods = [
        { name: "put", fn: (store: IDBObjectStore) => store.put(0, 0) },
        { name: "add", fn: (store: IDBObjectStore) => store.add(0, 0) },
        { name: "delete", fn: (store: IDBObjectStore) => store.delete(0) },
        { name: "clear", fn: (store: IDBObjectStore) => store.clear() },
        { name: "get", fn: (store: IDBObjectStore) => store.get(0) },
        { name: "getKey", fn: (store: IDBObjectStore) => store.getKey(0) },
        { name: "getAll", fn: (store: IDBObjectStore) => store.getAll() },
        {
            name: "getAllKeys",
            fn: (store: IDBObjectStore) => store.getAllKeys(),
        },
        { name: "count", fn: (store: IDBObjectStore) => store.count() },
        {
            name: "openCursor",
            fn: (store: IDBObjectStore) => store.openCursor(),
        },
        {
            name: "openKeyCursor",
            fn: (store: IDBObjectStore) => store.openKeyCursor(),
        },
    ]

    testMethods.forEach(({ name, fn }) => {
        test(`The source of the request from ${name} is the object store itself`, async ({
            task,
        }) => {
            const db = await createDatabase(task, (database) => {
                database.createObjectStore("store", { autoIncrement: true })
            })

            const tx = db.transaction("store", "readwrite")
            const store = tx.objectStore("store")

            const request = fn(store)
            expect(request.source).toBe(store)

            db.close()
        })
    })
})
