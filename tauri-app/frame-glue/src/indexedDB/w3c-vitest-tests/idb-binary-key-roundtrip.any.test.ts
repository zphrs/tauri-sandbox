import { describe, expect, test } from "vitest"
import { idb, createDatabase } from "./resources/createDatabase"

// Port of w3c test: idb-binary-key-roundtrip.any.js
// META: title=IndexedDB: Binary keys written to a database and read back
// META: timeout=long

const sample = [0x44, 0x33, 0x22, 0x11, 0xff, 0xee, 0xdd, 0xcc]
const buffer = new Uint8Array(sample).buffer

function assertKeyValid(a: unknown) {
    expect(idb.cmp(a, a)).toBe(0)
}

function assertBufferEquals(a: ArrayBuffer, b: ArrayBuffer) {
    expect(Array.from(new Uint8Array(a))).toEqual(Array.from(new Uint8Array(b)))
}

function assertKeyEquals(a: unknown, b: unknown) {
    expect(idb.cmp(a, b)).toBe(0)
}

// Verifies that a JavaScript value round-trips through IndexedDB as a key.
async function checkKeyRoundtrip(
    db: IDBDatabase,
    key: IDBValidKey,
    keyBuffer: ArrayBuffer,
): Promise<void> {
    return new Promise((resolve, reject) => {
        // First transaction: readwrite for putting the value
        const writeTx = db.transaction("store", "readwrite")
        const writeStore = writeTx.objectStore("store")

        // Verify put with key
        const putRequest = writeStore.put("value", key)
        putRequest.onerror = () => reject(new Error("put should succeed"))

        writeTx.oncomplete = () => {
            // Second transaction: readonly for getting the value and cursor operations
            const readTx = db.transaction("store", "readonly")
            const readStore = readTx.objectStore("store")

            // Verify get with key
            const getRequest = readStore.get(key)
            getRequest.onerror = () => reject(new Error("get should succeed"))
            getRequest.onsuccess = () => {
                expect(getRequest.result).toBe("value")

                // Verify iteration returning key
                const cursorRequest = readStore.openCursor()
                cursorRequest.onerror = () =>
                    reject(new Error("openCursor should succeed"))
                cursorRequest.onsuccess = () => {
                    expect(cursorRequest.result).not.toBeNull()
                    const retrievedKey = cursorRequest.result!.key
                    expect(retrievedKey).toBeInstanceOf(ArrayBuffer)
                    assertKeyEquals(retrievedKey, key)
                    assertBufferEquals(retrievedKey as ArrayBuffer, keyBuffer)

                    resolve()
                }
            }
        }

        writeTx.onerror = () =>
            reject(new Error("write transaction should succeed"))
    })
}

// Checks that IndexedDB handles the given view type for binary keys correctly.
function viewTypeTest(type: string) {
    test(`Binary keys can be supplied using the view type ${type}`, async ({
        task,
    }) => {
        const db = await createDatabase(task, (db) => {
            db.createObjectStore("store")
        })

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const key = new (globalThis as any)[type](buffer) as IDBValidKey
        assertKeyValid(key)
        assertKeyEquals(key, buffer)
        await checkKeyRoundtrip(db, key, buffer)
    })
}

// Test all TypedArray view types
;[
    "Uint8Array",
    "Uint8ClampedArray",
    "Int8Array",
    "Uint16Array",
    "Int16Array",
    "Uint32Array",
    "Int32Array",
    "Float32Array",
    "Float64Array",
].forEach((type) => {
    viewTypeTest(type)
})

// Note: Float16Array is not widely supported yet, so omitting it

// Checks that IndexedDB handles specific values correctly
function valueTest(
    valueDescription: string,
    value: IDBValidKey,
    valueBuffer: ArrayBuffer,
) {
    test(`${valueDescription} can be used to supply a binary key`, async ({
        task,
    }) => {
        const db = await createDatabase(task, (db) => {
            db.createObjectStore("store")
        })

        assertKeyValid(value)
        await checkKeyRoundtrip(db, value, valueBuffer)
    })
}

describe("Binary key roundtrip tests", () => {
    valueTest("ArrayBuffer", buffer, buffer)
    valueTest("DataView", new DataView(buffer), buffer)
    valueTest(
        "DataView with explicit offset",
        new DataView(buffer, 3),
        new Uint8Array([0x11, 0xff, 0xee, 0xdd, 0xcc]).buffer,
    )
    valueTest(
        "DataView with explicit offset and length",
        new DataView(buffer, 3, 4),
        new Uint8Array([0x11, 0xff, 0xee, 0xdd]).buffer,
    )
    valueTest(
        "Uint8Array with explicit offset",
        new Uint8Array(buffer, 3),
        new Uint8Array([0x11, 0xff, 0xee, 0xdd, 0xcc]).buffer,
    )
    valueTest(
        "Uint8Array with explicit offset and length",
        new Uint8Array(buffer, 3, 4),
        new Uint8Array([0x11, 0xff, 0xee, 0xdd]).buffer,
    )
})
