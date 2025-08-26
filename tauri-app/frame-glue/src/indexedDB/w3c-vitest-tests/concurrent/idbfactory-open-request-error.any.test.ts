import { describe, expect, test } from "vitest"
import { idb, requestToPromise } from "../resources/createDatabase"

// Port of w3c test: idbfactory-open-request-error.any.js
// Tests IDBOpenDBRequest properties on error

describe("IDBFactory open()", () => {
    test("request properties on error", async ({ task }) => {
        const name = task.id

        // Ensure no existing database
        const delReq = idb.deleteDatabase(name)
        await requestToPromise(delReq as unknown as IDBRequest<unknown>)

        let sawAbort = false
        const openReq = idb.open(name)
        openReq.onsuccess = () => {
            throw new Error("open should not succeed")
        }
        openReq.onupgradeneeded = () => {
            const db = openReq.result
            const tx = openReq.transaction!
            const store = db.createObjectStore("store")
            store.put({ name: "a" }, 1)
            store.put({ name: "a" }, 2)
            store.createIndex("index", "name", { unique: true })

            // During upgradeneeded
            expect(openReq.readyState).toBe("done")
            expect(openReq.result).toBe(db)
            expect(openReq.error).toBeNull()

            tx.onabort = () => {
                sawAbort = true
                expect(openReq.readyState).toBe("done")
            }
            tx.abort()
        }

        // Await the error event
        await new Promise<void>((resolve) => {
            openReq.onerror = () => resolve()
        })

        expect(sawAbort).toBe(true)
        expect(openReq.readyState).toBe("done")
        expect(openReq.result).toBeUndefined()
        expect(openReq.error).not.toBeNull()
        expect(openReq.error!.name).toBe("AbortError")
    })
})
