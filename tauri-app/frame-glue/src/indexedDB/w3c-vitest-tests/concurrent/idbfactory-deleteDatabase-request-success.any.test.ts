import { describe, expect, test } from "vitest"
import { idb, requestToPromise } from "../resources/createDatabase"

// Port of w3c test: idbfactory-deleteDatabase-request-success.any.js
// Tests IDBFactory.deleteDatabase() request properties on success

describe("IDBFactory deleteDatabase()", () => {
    test("request properties on success", async ({ task }) => {
        const name = task.id
        const rq = idb.deleteDatabase(name)
        rq.onerror = () => {
            throw new Error("deleteDatabase should succeed")
        }
        rq.onsuccess = () => {
            expect(rq.readyState).toBe("done")
            expect(rq.result).toBeUndefined()
            expect(rq.error).toBeNull()
        }
        // Cast to IDBRequest to match requestToPromise signature
        await requestToPromise(rq as unknown as IDBRequest<unknown>)
    })
})
