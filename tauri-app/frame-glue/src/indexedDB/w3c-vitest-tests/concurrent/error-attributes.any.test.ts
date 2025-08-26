import { describe, expect, test } from "vitest"
import { idb } from "../resources/createDatabase"

// Port of w3c test: error-attributes.any.js
// Tests that IDBRequest and IDBTransaction error properties are DOMExceptions
describe("error-attributes", () => {
    test("IDBRequest and IDBTransaction error properties should be DOMExceptions", async () => {
        const dbName = "testdb-" + Date.now() + Math.random()

        // First create and set up the database
        const setupRequest = idb.open(dbName, 1)
        await new Promise<void>((resolve, reject) => {
            setupRequest.onupgradeneeded = () => {
                const db = setupRequest.result
                db.createObjectStore("store")
            }
            setupRequest.onsuccess = () => resolve()
            setupRequest.onerror = () => reject(setupRequest.error)
        })

        // Now test the error attributes
        const openRequest = idb.open(dbName, 1)
        await new Promise<void>((resolve, reject) => {
            openRequest.onsuccess = () => {
                const db = openRequest.result
                const tx = db.transaction("store", "readwrite")
                const store = tx.objectStore("store")

                // First add should succeed
                const r1 = store.add("value", "key")
                r1.onerror = () => {
                    reject(new Error("first add should succeed"))
                }

                // Second add should fail with ConstraintError
                const r2 = store.add("value", "key")
                r2.onsuccess = () => {
                    reject(new Error("second add should fail"))
                }

                r2.onerror = () => {
                    try {
                        // Check that r2.error is a DOMException with ConstraintError
                        expect(r2.error).toBeInstanceOf(DOMException)
                        expect(r2.error?.name).toBe("ConstraintError")
                    } catch (err) {
                        reject(err as Error)
                        return
                    }
                }

                tx.oncomplete = () => {
                    reject(new Error("transaction should not complete"))
                }

                tx.onabort = () => {
                    try {
                        // Check that tx.error is a DOMException with ConstraintError
                        expect(tx.error).toBeInstanceOf(DOMException)
                        expect(tx.error?.name).toBe("ConstraintError")
                        resolve()
                    } catch (err) {
                        reject(err as Error)
                    } finally {
                        db.close()
                    }
                }
            }
            openRequest.onerror = () => reject(openRequest.error)
        })
    })
})
