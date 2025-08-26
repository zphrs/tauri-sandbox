import { describe, expect, test } from "vitest"
import {
    createDatabase,
    requestToPromise,
    idb,
} from "../resources/createDatabase"

// Port of w3c test: idbcursor-key.any.js
// Tests IDBCursor.key property

function assertKeyEquals(a: unknown, b: unknown) {
    expect(idb.cmp(a, b)).toBe(0)
}

function upgradeFunc(key: IDBValidKey) {
    return (db: IDBDatabase) => {
        const objStore = db.createObjectStore("test")
        objStore.add("data", key)
    }
}

async function testCursorKey(key: IDBValidKey, testName: string) {
    const db = await createDatabase({ id: testName }, upgradeFunc(key))

    const tx = db.transaction("test", "readonly")
    const store = tx.objectStore("test")
    const request = store.openCursor()

    const cursor = await requestToPromise(request)

    expect(cursor).not.toBeNull()
    expect(cursor!.value).toBe("data")

    // Test key equality
    assertKeyEquals(cursor!.key, key)

    // Test that key property is readonly (assignment should be ignored)
    const originalKey = cursor!.key
    // @ts-expect-error - Testing readonly property
    cursor!.key = "newKey"

    // Key should remain unchanged after assignment
    assertKeyEquals(cursor!.key, originalKey)

    // Test array key mutation behavior
    if (key instanceof Array) {
        const keyCopy = [...key]
        const cursorKey = cursor!.key as unknown as unknown[]
        cursorKey.push("new")
        key.push("new")

        assertKeyEquals(cursor!.key, key)
        // The original key should also be modified since arrays are mutable
        expect(cursor!.key).toEqual(key)
        expect(cursor!.key).not.toEqual(keyCopy)
    }
}

describe("IDBCursor.key", () => {
    test("key - number", async () => {
        await testCursorKey(1, "key-number")
    })

    test("key - string", async () => {
        await testCursorKey("key", "key-string")
    })

    test("key - array", async () => {
        await testCursorKey(["my", "key"], "key-array")
    })
})
