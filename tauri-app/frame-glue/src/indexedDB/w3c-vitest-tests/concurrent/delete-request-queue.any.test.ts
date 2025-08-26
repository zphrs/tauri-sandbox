import { describe, expect, test } from "vitest"
import { createDatabase, idb } from "../resources/createDatabase"

// Port of w3c test: delete-request-queue.any.js
// Tests that database deletion requests are processed as a FIFO queue
describe("delete-request-queue", () => {
    test("Deletes are processed as a FIFO queue", async ({ task }) => {
        const dbName = "testdb-" + Date.now() + Math.random()
        const events: string[] = []

        // Create the database first
        const db = await createDatabase(task, () => {})

        // Test the deletion queue behavior
        await new Promise<void>((resolve, reject) => {
            // First delete request
            const deleteRequest1 = idb.deleteDatabase(dbName)
            deleteRequest1.onerror = () => {
                reject(new Error("delete1 should succeed"))
            }
            deleteRequest1.onsuccess = () => {
                events.push("delete1")
            }

            // Second delete request
            const deleteRequest2 = idb.deleteDatabase(dbName)
            deleteRequest2.onerror = () => {
                reject(new Error("delete2 should succeed"))
            }
            deleteRequest2.onsuccess = () => {
                events.push("delete2")

                // Verify FIFO order
                try {
                    expect(events).toEqual(["delete1", "delete2"])
                    resolve()
                } catch (err) {
                    reject(err as Error)
                }
            }

            // Close the database to allow deletion
            db.close()
        })
    })
})
