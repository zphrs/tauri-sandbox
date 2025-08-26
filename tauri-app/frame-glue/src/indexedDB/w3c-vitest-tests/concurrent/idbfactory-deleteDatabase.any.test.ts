import { describe, test, expect } from "vitest"
import { idb, requestToPromise } from "../resources/createDatabase"
import { FDBVersionChangeEvent as IDBVersionChangeEvent } from "../../inMemoryIdb"

// Port of w3c test: idbfactory_deleteDatabase.any.js
// Tests IDBFactory.deleteDatabase() additional behaviors

describe("IDBFactory deleteDatabase()", () => {
    test("delete non-existent database - event.oldVersion is 0 and event.target.source is null", async ({
        task,
    }) => {
        const name = task.id
        const delReq = idb.deleteDatabase(name)
        await new Promise<void>((resolve, reject) => {
            delReq.onerror = () =>
                reject(new Error("deleteDatabase should succeed"))
            delReq.onsuccess = (e) => {
                const evt = e as unknown as IDBVersionChangeEvent
                expect(evt.oldVersion).toBe(0)
                // target.source is null for deleteDatabase
                expect(
                    (evt.target as unknown as IDBOpenDBRequest).source,
                ).toBeNull()
                resolve()
            }
        })
    })

    test("deleteDatabase success event is IDBVersionChangeEvent with oldVersion and newVersion null", async ({
        task,
    }) => {
        const name = task.id
        // Create a database at version 9
        const openReq = idb.open(name, 9)
        openReq.onupgradeneeded = () => {
            openReq.result.createObjectStore("os")
        }
        const db = await requestToPromise(
            openReq as unknown as IDBRequest<IDBDatabase>,
        )
        db.close()

        const delReq = idb.deleteDatabase(name)
        const evt = await new Promise<IDBVersionChangeEvent>(
            (resolve, reject) => {
                delReq.onerror = () => reject(delReq.error)
                delReq.onsuccess = (e) => {
                    const evt = e as unknown as IDBVersionChangeEvent
                    resolve(evt)
                }
            },
        )
        expect(evt.oldVersion).toBe(9)
        expect(evt.newVersion).toBeNull()
        expect(delReq.result).toBeUndefined()
        expect(evt).toBeInstanceOf(IDBVersionChangeEvent)
    })

    test("Delete an existing database when one connection is open already", async ({
        task,
    }) => {
        const name = task.id
        // Ensure no existing database
        await requestToPromise(
            idb.deleteDatabase(name) as unknown as IDBRequest<unknown>,
        )

        // Open database version 3 and keep a connection
        const openReq = idb.open(name, 3)
        openReq.onupgradeneeded = () => {
            openReq.result.createObjectStore("store")
        }
        const db = await requestToPromise(
            openReq as unknown as IDBRequest<IDBDatabase>,
        )
        // Fail on unexpected events
        db.onversionchange = () => {
            throw new Error("db.versionchange")
        }
        db.onerror = () => {
            throw new Error("db.error")
        }
        db.onabort = () => {
            throw new Error("db.abort")
        }

        // Close connection before deletion
        db.close()
        // Defer deletion to next tick
        await new Promise((r) => setTimeout(r, 0))

        await new Promise<void>((resolve, reject) => {
            const delReq = idb.deleteDatabase(name)
            delReq.onerror = () => reject(new Error("delete.error"))
            delReq.onblocked = () => reject(new Error("delete.blocked"))
            delReq.onupgradeneeded = () =>
                reject(new Error("delete.upgradeneeded"))
            delReq.onsuccess = () => resolve()
        })
    })
})
