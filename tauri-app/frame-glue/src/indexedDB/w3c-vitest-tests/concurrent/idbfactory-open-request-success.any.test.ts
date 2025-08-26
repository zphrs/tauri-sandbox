import { describe, expect, test } from "vitest"
import { idb, requestToPromise } from "../resources/createDatabase"

// Port of w3c test: idbfactory-open-request-success.any.js
// Tests IDBOpenDBRequest properties on success

describe("IDBFactory open()", () => {
    test("request properties on success", async ({ task }) => {
        const name = task.id

        let sawComplete = false
        const openReq = idb.open(name)
        openReq.onupgradeneeded = () => {
            const db = openReq.result
            const tx = openReq.transaction!
            // During upgradeneeded
            expect(openReq.readyState).toBe("done")
            expect(openReq.result).toBe(db)
            expect(openReq.error).toBeNull()

            tx.onabort = () => {
                throw new Error("transaction should complete")
            }
            tx.oncomplete = () => {
                sawComplete = true
                expect(openReq.readyState).toBe("done")
                expect(openReq.result).toBe(db)
                expect(openReq.error).toBeNull()
            }
        }

        const db = await requestToPromise(
            openReq as unknown as IDBRequest<IDBDatabase>,
        )

        expect(sawComplete).toBe(true)
        expect(openReq.readyState).toBe("done")
        expect(openReq.result).toBe(db)
        expect(openReq.error).toBeNull()
    })
})
