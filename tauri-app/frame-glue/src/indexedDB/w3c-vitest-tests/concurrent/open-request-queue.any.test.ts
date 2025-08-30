import { describe, expect, test } from "vitest"
import { idb, requestToPromise } from "../resources/createDatabase"

// Port of w3c test: open-request-queue.any.js
// Tests IndexedDB open and delete request queues

describe("IndexedDB open and delete request queues", { timeout: 10000 }, () => {
    test("IndexedDB: open and delete requests are processed as a FIFO queue", async ({
        task,
    }) => {
        // This test is skipped because it has a fundamental issue with version ordering:
        // When multiple open requests with different versions are queued, our implementation
        // doesn't properly handle the case where a lower version request (version 2)
        // tries to open after a higher version (version 3) has already been established.
        // This results in: VersionError: The requested version (2) is less than the existing version (3).

        const db_name = `db-${task.id}-${Date.now()}`

        // Clean up any existing database first
        await requestToPromise(
            idb.deleteDatabase(db_name) as unknown as IDBRequest<undefined>,
        )

        // Track events in order
        const events: string[] = []

        // Open and hold connection while other requests are queued up
        const r = idb.open(db_name, 1)
        const db = await requestToPromise(
            r as unknown as IDBRequest<IDBDatabase>,
        )

        function open(token: string, version: number): Promise<IDBDatabase> {
            return new Promise((resolve, reject) => {
                const r = idb.open(db_name, version)

                r.onsuccess = () => {
                    events.push(`${token} success`)
                    const db = r.result
                    db.onversionchange = () => {
                        events.push(`${token} versionchange`)
                        setTimeout(() => {
                            db.close()
                        }, 0)
                    }
                    resolve(db)
                }

                r.onblocked = () => {
                    events.push(`${token} blocked`)
                }
                r.onerror = () => {
                    reject(r.error)
                }
            })
        }

        function deleteDatabase(token: string): Promise<void> {
            return new Promise((resolve, reject) => {
                const r = idb.deleteDatabase(db_name)

                r.onsuccess = () => {
                    events.push(`${token} success`)
                    resolve()
                }

                r.onblocked = () => {
                    events.push(`${token} blocked`)
                }
                r.onerror = () => {
                    reject(r.error)
                }
            })
        }

        // Queue up operations
        const open1Promise = open("open1", 2)
        const delete1Promise = deleteDatabase("delete1")
        const open2Promise = open("open2", 3)
        const delete2Promise = deleteDatabase("delete2")

        // Now unblock the queue
        db.close()
        // Wait for all operations to complete
        await Promise.all([
            open1Promise,
            delete1Promise,
            open2Promise,
            delete2Promise,
        ])

        const expectedOrder = [
            "open1 success",
            "open1 versionchange",
            "delete1 blocked",
            "delete1 success",
            "open2 success",
            "open2 versionchange",
            "delete2 blocked",
            "delete2 success",
        ]

        expect(events).toEqual(expectedOrder)
    })
})
