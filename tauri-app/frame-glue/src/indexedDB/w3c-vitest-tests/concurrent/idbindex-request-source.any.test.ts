import { describe, test, expect } from "vitest"
import { createDatabase } from "../resources/createDatabase"

// Port of w3c test: idbindex-request-source.any.js
// Tests that the source of requests made against indexes is the index itself

describe("IDBIndex request source", () => {
    test("get() request source is the index", async ({ task }) => {
        const db = await createDatabase(task, (db) => {
            const store = db.createObjectStore("store", { autoIncrement: true })
            store.createIndex("index", "kp")
        })

        const tx = db.transaction("store", "readwrite")
        const index = tx.objectStore("store").index("index")
        const request = index.get(0)
        expect(request.source).toBe(index)
    })

    test("getKey() request source is the index", async ({ task }) => {
        const db = await createDatabase(task, (db) => {
            const store = db.createObjectStore("store", { autoIncrement: true })
            store.createIndex("index", "kp")
        })

        const tx = db.transaction("store", "readwrite")
        const index = tx.objectStore("store").index("index")
        const request = index.getKey(0)
        expect(request.source).toBe(index)
    })

    test("getAll() request source is the index", async ({ task }) => {
        const db = await createDatabase(task, (db) => {
            const store = db.createObjectStore("store", { autoIncrement: true })
            store.createIndex("index", "kp")
        })

        const tx = db.transaction("store", "readwrite")
        const index = tx.objectStore("store").index("index")
        const request = index.getAll()
        expect(request.source).toBe(index)
    })

    test("getAllKeys() request source is the index", async ({ task }) => {
        const db = await createDatabase(task, (db) => {
            const store = db.createObjectStore("store", { autoIncrement: true })
            store.createIndex("index", "kp")
        })

        const tx = db.transaction("store", "readwrite")
        const index = tx.objectStore("store").index("index")
        const request = index.getAllKeys()
        expect(request.source).toBe(index)
    })

    test("count() request source is the index", async ({ task }) => {
        const db = await createDatabase(task, (db) => {
            const store = db.createObjectStore("store", { autoIncrement: true })
            store.createIndex("index", "kp")
        })

        const tx = db.transaction("store", "readwrite")
        const index = tx.objectStore("store").index("index")
        const request = index.count()
        expect(request.source).toBe(index)
    })

    test("openCursor() request source is the index", async ({ task }) => {
        const db = await createDatabase(task, (db) => {
            const store = db.createObjectStore("store", { autoIncrement: true })
            store.createIndex("index", "kp")
        })

        const tx = db.transaction("store", "readwrite")
        const index = tx.objectStore("store").index("index")
        const request = index.openCursor()
        expect(request.source).toBe(index)
    })

    test("openKeyCursor() request source is the index", async ({ task }) => {
        const db = await createDatabase(task, (db) => {
            const store = db.createObjectStore("store", { autoIncrement: true })
            store.createIndex("index", "kp")
        })

        const tx = db.transaction("store", "readwrite")
        const index = tx.objectStore("store").index("index")
        const request = index.openKeyCursor()
        expect(request.source).toBe(index)
    })
})
