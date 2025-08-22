import { describe, expect, test } from "vitest"
import { createDatabase, requestToPromise } from "./resources/createDatabase"

// Port of w3c test: idbcursor-direction.any.js
// Tests IDBCursor.direction property

function upgradeFunc(db: IDBDatabase) {
    const objStore = db.createObjectStore("test")
    objStore.add("data", "key")
}

describe("IDBCursor.direction", () => {
    test("direction - default", async ({ task }) => {
        const db = await createDatabase(task, upgradeFunc)

        const tx = db.transaction("test", "readonly")
        const store = tx.objectStore("test")

        // Test default direction (should be "next")
        const request1 = store.openCursor()
        const cursor1 = await requestToPromise(request1)

        expect(cursor1).not.toBeNull()
        expect(cursor1!.direction).toBe("next")

        // Test explicit "next" direction
        const request2 = store.openCursor(undefined, "next")
        const cursor2 = await requestToPromise(request2)

        expect(cursor2).not.toBeNull()
        expect(cursor2!.direction).toBe("next")
    })

    test("direction - next", async ({ task }) => {
        const db = await createDatabase(task, upgradeFunc)

        const tx = db.transaction("test", "readonly")
        const store = tx.objectStore("test")

        const request = store.openCursor(undefined, "next")
        const cursor = await requestToPromise(request)

        expect(cursor).not.toBeNull()
        expect(cursor!.direction).toBe("next")
    })

    test("direction - prev", async ({ task }) => {
        const db = await createDatabase(task, upgradeFunc)

        const tx = db.transaction("test", "readonly")
        const store = tx.objectStore("test")

        const request = store.openCursor(undefined, "prev")
        const cursor = await requestToPromise(request)

        expect(cursor).not.toBeNull()
        expect(cursor!.direction).toBe("prev")
    })

    test("direction - nextunique", async ({ task }) => {
        const db = await createDatabase(task, upgradeFunc)

        const tx = db.transaction("test", "readonly")
        const store = tx.objectStore("test")

        const request = store.openCursor(undefined, "nextunique")
        const cursor = await requestToPromise(request)

        expect(cursor).not.toBeNull()
        expect(cursor!.direction).toBe("nextunique")
    })

    test("direction - prevunique", async ({ task }) => {
        const db = await createDatabase(task, upgradeFunc)

        const tx = db.transaction("test", "readonly")
        const store = tx.objectStore("test")

        const request = store.openCursor(undefined, "prevunique")
        const cursor = await requestToPromise(request)

        expect(cursor).not.toBeNull()
        expect(cursor!.direction).toBe("prevunique")
    })

    test("direction property is readonly", async ({ task }) => {
        const db = await createDatabase(task, upgradeFunc)

        const tx = db.transaction("test", "readonly")
        const store = tx.objectStore("test")

        const request = store.openCursor()
        const cursor = await requestToPromise(request)

        expect(cursor).not.toBeNull()

        // Test that direction property is readonly (assignment should be ignored)
        const originalDirection = cursor!.direction
        // @ts-expect-error - Testing readonly property
        cursor!.direction = "prev"

        // Direction should remain unchanged after assignment
        expect(cursor!.direction).toBe(originalDirection)
    })
})
