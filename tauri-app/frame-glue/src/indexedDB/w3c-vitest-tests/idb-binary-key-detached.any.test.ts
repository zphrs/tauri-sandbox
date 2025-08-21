import { describe, expect, test } from "vitest"
import { createDatabase, requestToPromise } from "./resources/createDatabase"

// Port of w3c test: idb-binary-key-detached.any.js
// META: title= IndexedDB: Detached buffers supplied as binary keys

// Returns a detached ArrayBuffer by transferring it to a message port.
function createDetachedArrayBuffer() {
    const array = new Uint8Array([1, 2, 3, 4])
    const buffer = array.buffer
    expect(array.byteLength).toBe(4)

    const channel = new MessageChannel()
    channel.port1.postMessage("", [buffer])
    expect(array.byteLength).toBe(0)
    return array
}

describe("idb-binary-key-detached", () => {
    test("Detached ArrayBuffers must throw DataError when used as a key", async () => {
        const db = await createDatabase(
            { id: "detached-arraybuffers" },
            (db) => {
                db.createObjectStore("store")
            },
        )

        const tx = db.transaction("store", "readwrite")
        const store = tx.objectStore("store")

        const array = createDetachedArrayBuffer()
        const buffer = array.buffer

        // Test direct detached ArrayBuffer as key
        await expect(async () => {
            const request = store.put("", buffer)
            // @ts-expect-error ts(2550)
            expect(buffer.detached).toBe(true)
            await requestToPromise(request)
        }).rejects.toThrow()

        // Test detached ArrayBuffer in array as key
        await expect(async () => {
            const request = store.put("", [buffer])
            await requestToPromise(request)
        }).rejects.toThrow()
    })

    test("Detached TypedArrays must throw DataError when used as a key", async () => {
        const db = await createDatabase(
            { id: "detached-typedarrays" },
            (db) => {
                db.createObjectStore("store")
            },
        )

        const tx = db.transaction("store", "readwrite")
        const store = tx.objectStore("store")

        const array = createDetachedArrayBuffer()

        // Test direct detached TypedArray as key
        await expect(async () => {
            const request = store.put("", array)
            await requestToPromise(request)
        }).rejects.toThrow()

        // Test detached TypedArray in array as key
        await expect(async () => {
            const request = store.put("", [array])
            await requestToPromise(request)
        }).rejects.toThrow()
    })
})
