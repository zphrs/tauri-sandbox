import { test, expect, onTestFinished } from "vitest"
import {
    createDatabase,
    idb,
    requestToPromise,
} from "../resources/createDatabase"

// Port of w3c test: close-in-upgradeneeded.any.js
// Verifies calling `close()` inside the `onupgradeneeded` handler closes the
// connection so that subsequent operations on the connection fail.

test(
    "Calling close() inside onupgradeneeded closes the connection",
    { timeout: 20000 },
    async ({ task }) => {
        let heldDb: IDBDatabase | undefined = undefined
        let caught = false
        try {
            await createDatabase(task, (db) => {
                expect(db.version).toBe(1)
                heldDb = db
                db.createObjectStore("os")
                // Close the connection from within the upgrade handler
                db.close()
            })
        } catch (error: unknown) {
            caught = true
            const e = error as DOMException
            expect(e.name).toBe("AbortError")
            expect(heldDb).toBeTruthy()
            expect(heldDb!.version).toBe(1)
            expect(heldDb!.objectStoreNames.length).toBe(1)
            expect(() => heldDb!.transaction("os", "readonly")).toThrow(
                "InvalidStateError",
            )
        }
        expect(caught).toBeTruthy()
    },
)
