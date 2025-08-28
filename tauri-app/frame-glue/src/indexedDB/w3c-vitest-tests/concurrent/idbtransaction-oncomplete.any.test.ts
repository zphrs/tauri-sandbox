import { describe, test, expect } from "vitest"
import { idb } from "../resources/createDatabase"

// Port of w3c test: idbtransaction-oncomplete.any.js
// Tests IDBTransaction complete event

describe("IDBTransaction - complete event", () => {
    test("complete event timing", async ({ task }) => {
        const dbName = `testdb-${task.id}-${Date.now()}`
        const stages: string[] = []

        const openReq = idb.open(dbName)

        await new Promise<void>((resolve, reject) => {
            openReq.onupgradeneeded = (e) => {
                stages.push("upgradeneeded")

                const db = (e.target as IDBOpenDBRequest).result
                db.createObjectStore("store")

                const tx = (e.target as IDBOpenDBRequest).transaction!
                tx.oncomplete = () => {
                    stages.push("complete")
                }
            }

            openReq.onsuccess = (e) => {
                stages.push("success")

                const db = (e.target as IDBOpenDBRequest).result
                const tx = db.transaction("store", "readonly")
                const store = tx.objectStore("store")

                store.openCursor().onsuccess = () => {
                    stages.push("opencursor")
                }

                db
                    .transaction("store", "readonly")
                    .objectStore("store")
                    .count().onsuccess = () => {
                    expect(stages).toEqual([
                        "upgradeneeded",
                        "complete",
                        "success",
                        "opencursor",
                    ])

                    db.close()
                    resolve()
                }

                db.onerror = reject
            }

            openReq.onerror = reject
        })

        // Cleanup
        await new Promise<void>((resolve) => {
            const deleteReq = idb.deleteDatabase(dbName)
            deleteReq.onsuccess = () => resolve()
            deleteReq.onerror = () => resolve()
        })
    })
})
