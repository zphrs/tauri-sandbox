import { describe, expect, test } from "vitest"
import {
    createDatabase,
    idb,
    requestToPromise,
} from "../resources/createDatabase"

// Port of w3c test: idbdatabase_close.any.js
// Tests IDBDatabase.close() functionality

describe("IDBDatabase.close()", () => {
    test("Unblock the version change transaction created by an open database request", async ({
        task,
    }) => {
        let versionchangeFired = false
        let blockedFired = false
        let upgradeNeededFired = false

        const db = await createDatabase(task, () => {
            // Initial setup
        })

        const dbName = db.name
        const dbVersion = db.version

        // Set up versionchange event handler
        db.onversionchange = () => {
            versionchangeFired = true
        }

        // Open a new version of the database
        const openReq = idb.open(dbName, dbVersion + 1)

        openReq.onblocked = () => {
            blockedFired = true
            db.close() // Unblock by closing the first connection
        }

        openReq.onupgradeneeded = () => {
            upgradeNeededFired = true
        }

        const db2 = await requestToPromise(
            openReq as unknown as IDBRequest<IDBDatabase>,
        )

        expect(versionchangeFired).toBe(true)
        expect(blockedFired).toBe(true)
        expect(upgradeNeededFired).toBe(true)

        db2.close()
    })

    test("Unblock the delete database request", async ({ task }) => {
        let versionchangeFired = false
        let blockedFired = false

        const db = await createDatabase(task, () => {
            // Initial setup
        })

        const dbName = db.name

        // Set up versionchange event handler
        db.onversionchange = () => {
            versionchangeFired = true
        }

        // Try to delete the database while it's still open
        const deleteReq = idb.deleteDatabase(dbName)

        deleteReq.onblocked = () => {
            blockedFired = true
            db.close() // Unblock by closing the connection
        }

        await requestToPromise(deleteReq as unknown as IDBRequest)

        expect(versionchangeFired).toBe(true)
        expect(blockedFired).toBe(true)
    })
})
