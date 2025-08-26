import { test, expect } from "vitest"
import { createDatabase, requestToPromise } from "../resources/createDatabase"

// Port of w3c test: blob-valid-after-abort.any.js
// Verifies a Blob read back from an aborted transaction remains readable.

const key = "key"

test("A blob can be read back after the transaction that added it was aborted", async ({
    task,
}) => {
    const db = await createDatabase(task, (db) => {
        db.createObjectStore("store")
    })

    const blobAContent = "Blob A content"
    const blobA = new Blob([blobAContent], { type: "text/plain" })
    const value = { a0: blobA }

    const txn = db.transaction("store", "readwrite")
    const store = txn.objectStore("store")

    store.put(value, key)
    const readBlob: Blob = (await requestToPromise(store.get(key))).a0

    const tPromise = new Promise<string>(
        (res) =>
            (txn.onabort = async () => {
                res(await readBlob.text())
            }),
    )

    txn.abort()

    expect(await tPromise).toBe(blobAContent)
})
