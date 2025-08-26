import { describe, expect, test } from "vitest"
import { idb, requestToPromise } from "../resources/createDatabase"

// Port of w3c test: idbfactory-open-error-properties.any.js
// Tests properties of error event from failed open()

describe("IDBFactory open()", () => {
    test("properties of error event from failed open()", async ({ task }) => {
        const name = task.id

        // Ensure no existing database
        const delReq = idb.deleteDatabase(name)
        await requestToPromise(delReq as unknown as IDBRequest<unknown>)

        // Attempt to open and abort during upgrade to trigger error
        const openReq = idb.open(name)
        openReq.onsuccess = () => {
            throw new Error("open should not succeed")
        }
        openReq.onupgradeneeded = () => {
            // transaction is defined during upgrade
            openReq.transaction!.abort()
        }

        // Await the error event
        const errEvent = await new Promise<Event>((resolve) => {
            openReq.onerror = (e: Event) => resolve(e)
        })

        expect(errEvent.target).toBe(openReq)
        expect(errEvent.type).toBe("error")
        expect(errEvent.bubbles).toBe(true)
        expect(errEvent.cancelable).toBe(true)
    })
})
