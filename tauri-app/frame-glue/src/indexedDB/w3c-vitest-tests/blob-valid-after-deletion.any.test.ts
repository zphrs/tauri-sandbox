import { test, expect } from "vitest"
import { createDatabase } from "./resources/createDatabase"
import { requestToPromise } from "../methods/readFromStore"

// Port of w3c test: blob-valid-after-deletion.any.js
// Verifies a Blob read back from a record remains readable after the record is deleted.

const key = "key"

test("Blobs stay alive after their records are deleted", async ({ task }) => {
    const db = await createDatabase(task, (db) => {
        db.createObjectStore("store")
    })

    const blobAContent = "Blob A content"
    const blobBContent = "Blob B content"
    const blobA = new Blob([blobAContent], { type: "text/plain" })
    const blobB = new Blob([blobBContent], { type: "text/plain" })
    let value = { a0: blobA, a1: blobA, b0: blobB }

    // Put the record
    const putTxn = db.transaction("store", "readwrite")
    const putStore = putTxn.objectStore("store")
    await requestToPromise(putStore.put(value, key))
    value = null as unknown as typeof value

    // Read the record in a readonly transaction
    const readTxn = db.transaction("store", "readonly")
    const readStore = readTxn.objectStore("store")
    const record = await requestToPromise(readStore.get(key))

    // Wait for the readonly transaction to complete so the record is stable
    await new Promise<void>((res) => (readTxn.oncomplete = () => res()))

    // Delete the record in a separate readwrite transaction
    const delTxn = db.transaction("store", "readwrite")
    const delStore = delTxn.objectStore("store")
    await requestToPromise(delStore.delete(key))
    await new Promise<void>((res) => (delTxn.oncomplete = () => res()))

    // The Blobs stored on the previously-retrieved record should still be readable
    const textA0 = await record.a0.text()
    const textA1 = await record.a1.text()
    const textB0 = await record.b0.text()

    expect(textA0).toBe(blobAContent)
    expect(textA1).toBe(blobAContent)
    expect(textB0).toBe(blobBContent)
})
