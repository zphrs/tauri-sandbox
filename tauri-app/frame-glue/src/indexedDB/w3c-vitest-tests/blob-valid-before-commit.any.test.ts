import { test, expect } from "vitest"
import { createDatabase } from "./resources/createDatabase"
import { requestToPromise } from "../methods/readFromStore"

// Port of w3c test: blob-valid-before-commit.any.js
// Verifies Blobs can be read back before their records are committed.

const key = "key"

test("Blobs can be read back before their records are committed", async ({
    task,
}) => {
    const db = await createDatabase(task, (db) => {
        db.createObjectStore("store")
    })

    const blobAContent = "Blob A content"
    const blobBContent = "Blob B content"
    const blobA = new Blob([blobAContent], { type: "text/plain" })
    const blobB = new Blob([blobBContent], { type: "text/plain" })
    let value = { a0: blobA, a1: blobA, b0: blobB }

    const tx = db.transaction("store", "readwrite")
    const store = tx.objectStore("store")

    // Put the record and then read it back within the same transaction
    await requestToPromise(store.put(value, key))
    value = null as unknown as typeof value

    const record = await requestToPromise(store.get(key))

    // The Blobs stored on the retrieved record should be readable immediately
    const textA0 = await record.a0.text()
    const textA1 = await record.a1.text()
    const textB0 = await record.b0.text()

    expect(textA0).toBe(blobAContent)
    expect(textA1).toBe(blobAContent)
    expect(textB0).toBe(blobBContent)
})
