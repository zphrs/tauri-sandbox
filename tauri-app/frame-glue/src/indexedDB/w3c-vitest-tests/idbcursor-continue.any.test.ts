import { describe, expect, test } from "vitest"
import { createDatabase, requestToPromise } from "./resources/createDatabase"
import { FDBKeyRange as IDBKeyRange } from "../inMemoryIdb"

// Port of w3c test: idbcursor-continue.any.js
// Tests IDBCursor.continue() method functionality

const store = [
    { value: "cupcake", key: 5 },
    { value: "pancake", key: 3 },
    { value: "pie", key: 1 },
    { value: "pie", key: 4 },
    { value: "taco", key: 2 },
]

function upgradeFunc(db: IDBDatabase) {
    const objStore = db.createObjectStore("test")
    objStore.createIndex("index", "")

    for (let i = 0; i < store.length; i++) {
        objStore.add(store[i].value, store[i].key)
    }
}

describe("IDBCursor.continue()", () => {
    test("continues without parameter", async ({ task }) => {
        const db = await createDatabase(task, upgradeFunc)

        const tx = db.transaction("test", "readonly")
        const index = tx.objectStore("test").index("index")
        const request = index.openCursor()

        // Get first result
        let cursor = await requestToPromise(request)
        expect(cursor).not.toBeNull()
        expect(cursor!.value).toBe("cupcake")
        expect(cursor!.primaryKey).toBe(5)

        // Continue to next
        cursor!.continue()
        cursor = await requestToPromise(request)
        expect(cursor).not.toBeNull()
        expect(cursor!.value).toBe("pancake")
        expect(cursor!.primaryKey).toBe(3)

        // Continue to next
        cursor!.continue()
        cursor = await requestToPromise(request)
        expect(cursor).not.toBeNull()
        expect(cursor!.value).toBe("pie")
        expect(cursor!.primaryKey).toBe(1)

        // Continue to next
        cursor!.continue()
        cursor = await requestToPromise(request)
        expect(cursor).not.toBeNull()
        expect(cursor!.value).toBe("pie")
        expect(cursor!.primaryKey).toBe(4)

        // Continue to next
        cursor!.continue()
        cursor = await requestToPromise(request)
        expect(cursor).not.toBeNull()
        expect(cursor!.value).toBe("taco")
        expect(cursor!.primaryKey).toBe(2)

        // Continue past end
        cursor!.continue()
        cursor = await requestToPromise(request)
        expect(cursor).toBeNull()
    })

    test("with given key", async ({ task }) => {
        const db = await createDatabase(task, upgradeFunc)

        const tx = db.transaction("test", "readonly")
        const index = tx.objectStore("test").index("index")
        const request = index.openCursor()

        // Get first result
        let cursor = await requestToPromise(request)
        expect(cursor).not.toBeNull()
        expect(cursor!.value).toBe("cupcake")
        expect(cursor!.primaryKey).toBe(5)

        // Continue to "pie"
        cursor!.continue("pie")
        cursor = await requestToPromise(request)
        expect(cursor).not.toBeNull()
        expect(cursor!.value).toBe("pie")
        expect(cursor!.primaryKey).toBe(1)

        // Continue to "taco"
        cursor!.continue("taco")
        cursor = await requestToPromise(request)
        expect(cursor).not.toBeNull()
        expect(cursor!.value).toBe("taco")
        expect(cursor!.primaryKey).toBe(2)

        // Continue past end
        cursor!.continue()
        cursor = await requestToPromise(request)
        expect(cursor).toBeNull()
    })

    test("skip to end with large key", async ({ task }) => {
        const db = await createDatabase(task, upgradeFunc)

        const tx = db.transaction("test", "readonly")
        const index = tx.objectStore("test").index("index")
        const request = index.openCursor()

        let cursor = await requestToPromise(request)
        expect(cursor).not.toBeNull()
        expect(cursor!.value).toBe("cupcake")
        expect(cursor!.primaryKey).toBe(5)

        // Skip past all remaining entries
        cursor!.continue("zzz")
        cursor = await requestToPromise(request)
        expect(cursor).toBeNull()
    })

    test("within range", async ({ task }) => {
        const db = await createDatabase(task, upgradeFunc)

        const tx = db.transaction("test", "readonly")
        const index = tx.objectStore("test").index("index")
        const request = index.openCursor(
            IDBKeyRange.lowerBound("cupcake", true),
        )

        // First result (skipping "cupcake")
        let cursor = await requestToPromise(request)
        expect(cursor).not.toBeNull()
        expect(cursor!.value).toBe("pancake")
        expect(cursor!.primaryKey).toBe(3)

        // Continue to "pie"
        cursor!.continue("pie")
        cursor = await requestToPromise(request)
        expect(cursor).not.toBeNull()
        expect(cursor!.value).toBe("pie")
        expect(cursor!.primaryKey).toBe(1)

        // Skip to end
        cursor!.continue("zzz")
        cursor = await requestToPromise(request)
        expect(cursor).toBeNull()
    })

    test("within single key range", async ({ task }) => {
        const db = await createDatabase(task, upgradeFunc)
        console.log("{")
        const tx = db.transaction("test", "readonly")
        const index = tx.objectStore("test").index("index")
        const request = index.openCursor("pancake")

        console.log("A")

        let cursor = await requestToPromise(request)
        expect(cursor).not.toBeNull()
        expect(cursor!.value).toBe("pancake")
        expect(cursor!.primaryKey).toBe(3)
        console.log("B")

        // Skip past this range
        cursor!.continue("pie")
        console.log("C")
        cursor = await requestToPromise(request)
        console.log("D")
        expect(cursor).toBeNull()
        console.log("}")
    })

    test("within single key range, with several results", async ({ task }) => {
        const db = await createDatabase(task, upgradeFunc)

        const tx = db.transaction("test", "readonly")
        const index = tx.objectStore("test").index("index")
        const request = index.openCursor("pie")

        // First pie
        let cursor = await requestToPromise(request)
        expect(cursor).not.toBeNull()
        expect(cursor!.value).toBe("pie")
        expect(cursor!.primaryKey).toBe(1)

        // Continue to next pie
        cursor!.continue()
        cursor = await requestToPromise(request)
        expect(cursor).not.toBeNull()
        expect(cursor!.value).toBe("pie")
        expect(cursor!.primaryKey).toBe(4)

        // Continue past end
        cursor!.continue()
        cursor = await requestToPromise(request)
        expect(cursor).toBeNull()
    })
})
