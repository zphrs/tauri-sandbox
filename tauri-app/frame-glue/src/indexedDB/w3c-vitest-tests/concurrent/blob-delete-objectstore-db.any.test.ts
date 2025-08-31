import { describe, expect, test } from "vitest"
import {
    createDatabase,
    idb,
    migrateNamedDatabase,
    requestToPromise,
} from "../resources/createDatabase"

// Port of w3c test: blob-delete-objectstore-db.any.js
// Verify that deleting an object store in an upgrade transaction removes it from the
// database at the new version.

const key = "blob key"
describe("blob delete objectstore", { timeout: 60000 }, () => {
    test("Delete objectStore in upgrade removes it from database", async ({
        task,
    }) => {
        await requestToPromise(
            idb.deleteDatabase(task.id) as unknown as IDBRequest<unknown>,
        )
        // Create initial database with one object store
        let justCreated = false
        let db = await createDatabase(task, (db) => {
            const store0 = db.createObjectStore("store0")
            db.createObjectStore("store1")

            const blobAContent = "First blob content"
            const blobA = new Blob([blobAContent], { type: "text/plain" })
            store0.put(blobA, key)
            justCreated = true
        })

        expect(justCreated).toBeTruthy()

        db.close()

        // Open at higher version and delete the object store during onupgradeneeded
        db = await migrateNamedDatabase(task, db.name, db.version + 1, (db) => {
            db.deleteObjectStore("store0")
        })

        const blobBContent = "Second blob content"
        const trans = db.transaction("store1", "readwrite")
        const store1 = trans.objectStore("store1")
        const blobB = new Blob([blobBContent], { type: "text/plain" })
        store1.put(blobB, key)
    })
})
