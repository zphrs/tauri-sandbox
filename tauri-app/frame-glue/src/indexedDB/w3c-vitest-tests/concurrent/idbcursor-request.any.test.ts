import { describe, test, expect } from "vitest"
import { createDatabase, requestToPromise } from "../resources/createDatabase"

// Port of w3c test: idbcursor-request.any.js
// Verifies `cursor.request` points to the originating openCursor/openKeyCursor request,
// is effectively read-only, and remains stable after transaction completion.

function upgrade(db: IDBDatabase) {
    const objStore = db.createObjectStore("my_objectstore")
    // Use empty string keyPath to mirror existing tests in this suite.
    objStore.createIndex("my_index", "")
    objStore.add("data", 1)
}

type Source = IDBObjectStore | IDBIndex

function getSource(tx: IDBTransaction, useIndex: boolean): Source {
    let src: Source = tx.objectStore("my_objectstore")
    if (useIndex) src = src.index("my_index")
    return src
}

async function waitForTransactionComplete(tx: IDBTransaction): Promise<void> {
    await new Promise<void>((resolve) => {
        tx.oncomplete = () => setTimeout(resolve, 0)
        tx.onerror = () => resolve()
        tx.onabort = () => resolve()
    })
}

describe("IDBCursor.request", () => {
    for (const useIndex of [false, true] as const) {
        for (const useKeyCursor of [false, true] as const) {
            const label = `${useIndex ? "IDBIndex" : "IDBObjectStore"}.${
                useKeyCursor ? "openKeyCursor" : "openCursor"
            }`

            test(`cursor.request from ${label}`, async ({ task }) => {
                const db = await createDatabase(task, upgrade)
                const tx = db.transaction("my_objectstore", "readonly")
                const src = getSource(tx, useIndex)

                const req = useKeyCursor
                    ? src.openKeyCursor()
                    : src.openCursor()

                const cursor = await requestToPromise(
                    req as IDBRequest<IDBCursorWithValue | IDBCursor | null>,
                )
                expect(cursor).not.toBeNull()

                // cursor.request matches and is stable
                expect(cursor!.request).toBe(req)
                expect(cursor!.request).toBe(cursor!.request)

                // Read-only: assignment should not change the value
                const original = cursor!.request
                try {
                    ;(cursor as unknown as { request: unknown }).request = {}
                } catch {
                    // ignore - attempting to mutate read-only property
                }
                expect(cursor!.request).toBe(original)

                // After transaction completes, it should still be the same request
                await waitForTransactionComplete(tx)
                expect(cursor!.request).toBe(req)
            })
        }
    }
})
