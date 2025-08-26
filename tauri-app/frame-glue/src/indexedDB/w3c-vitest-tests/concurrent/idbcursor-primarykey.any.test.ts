import { describe, expect, test } from "vitest"
import {
    createDatabase,
    requestToPromise,
    idb,
} from "../resources/createDatabase"

// Port of w3c test: idbcursor-primarykey.any.js
// Tests IDBCursor.primaryKey property

function assertKeyEquals(a: unknown, b: unknown) {
    expect(idb.cmp(a, b)).toBe(0)
}

function upgradeFunc(key: IDBValidKey) {
    return (db: IDBDatabase) => {
        const objStore = db.createObjectStore("test")
        objStore.createIndex("index", "")
        objStore.add("data", key)
    }
}

async function testCursorPrimaryKey(key: IDBValidKey, testName: string) {
    const db = await createDatabase({ id: testName }, upgradeFunc(key))

    const tx = db.transaction("test", "readonly")
    const store = tx.objectStore("test")
    const index = store.index("index")
    const request = index.openCursor()

    const cursor = await requestToPromise(request)

    expect(cursor).not.toBeNull()
    expect(cursor!.value).toBe("data")
    expect(cursor!.key).toBe("data")

    // Test primaryKey equality
    assertKeyEquals(cursor!.primaryKey, key)

    // Test that primaryKey property is readonly (assignment should be ignored)
    const originalPrimaryKey = cursor!.primaryKey
    // @ts-expect-error - Testing readonly property
    cursor!.primaryKey = "newKey"

    // Primary key should remain unchanged after assignment
    assertKeyEquals(cursor!.primaryKey, originalPrimaryKey)

    // Test array key mutation behavior
    if (key instanceof Array) {
        const cursorPrimaryKey = cursor!.primaryKey as unknown as unknown[]
        cursorPrimaryKey.push("new")
        key.push("new")

        // Both should have been mutated since they reference the same array
        assertKeyEquals(cursor!.primaryKey, key)
    }
}

describe("IDBCursor.primaryKey", () => {
    test("primaryKey with number key", async () => {
        await testCursorPrimaryKey(1, "number-key")
    })

    test("primaryKey with string key", async () => {
        await testCursorPrimaryKey("key", "string-key")
    })

    test("primaryKey with array key", async () => {
        await testCursorPrimaryKey(["my", "key"], "array-key")
    })
})
