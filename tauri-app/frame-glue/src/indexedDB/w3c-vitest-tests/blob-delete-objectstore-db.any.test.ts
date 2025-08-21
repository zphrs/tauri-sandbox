import { onTestFinished, test } from "vitest"
import {
    createDatabase,
    idb,
    requestToPromise,
} from "./resources/createDatabase"

// Port of w3c test: blob-delete-objectstore-db.any.js
// Verify that deleting an object store in an upgrade transaction removes it from the
// database at the new version.

const key = "blob key"

test("Delete objectStore in upgrade removes it from database", async ({
    task,
}) => {
    // Create initial database with one object store
    const db = await createDatabase(task, (db) => {
        const store0 = db.createObjectStore("store0")
        db.createObjectStore("store1")

        const blobAContent = "First blob content"
        const blobA = new Blob([blobAContent], { type: "text/plain" })
        store0.put(blobA, key)
    })

    db.close()
    // Open at higher version and delete the object store during onupgradeneeded
    const req = idb.open(db.name, db.version + 1)

    const promise = new Promise<void>((resolve, reject) => {
        req.onupgradeneeded = (e) => {
            const target = e.target as IDBOpenDBRequest
            const upgradeDb = target.result
            upgradeDb.deleteObjectStore("store0")
        }

        req.onsuccess = async () => {
            const db = req.result
            onTestFinished(async () => {
                db.close()
                await requestToPromise(indexedDB.deleteDatabase(db.name))
            })
            const blobBContent = "Second blob content"
            const trans = db.transaction("store1", "readwrite")
            const store1 = trans.objectStore("store1")
            const blobB = new Blob([blobBContent], { type: "text/plain" })
            store1.put(blobB, key)

            resolve()

            trans.onabort = () =>
                reject(new Error("Transaction should not be aborted."))
        }

        req.onerror = () => reject(req.error)
    })

    await promise
})
