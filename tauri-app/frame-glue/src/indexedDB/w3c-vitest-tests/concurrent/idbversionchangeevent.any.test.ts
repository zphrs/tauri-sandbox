import { describe, test, expect } from "vitest"
import Event from "../../inMemoryIdb/lib/FakeEvent"
import { idb, cleanupDbRefAfterTest } from "../resources/createDatabase"

// Port of w3c test: idbversionchangeevent.any.js
// Tests IDBVersionChangeEvent properties and behavior

describe("IDBVersionChangeEvent", () => {
    test("fired in upgradeneeded, versionchange and deleteDatabase", async ({
        task,
    }) => {
        const dbname = `${task.id}-idbversionchangeevent`

        // First delete any existing database
        await new Promise<void>((resolve) => {
            const deleteReq = idb.deleteDatabase(dbname)
            deleteReq.onsuccess = () => resolve()
            deleteReq.onerror = () => resolve() // Ignore errors for non-existent DB
        })

        // Open database with version 3
        const openEvents: Array<{
            type: string
            oldVersion: number
            newVersion: number | null
        }> = []
        let versionChangeEventReceived = false

        const db = await new Promise<IDBDatabase>((resolve, reject) => {
            const openrq = idb.open(dbname, 3)

            openrq.onupgradeneeded = (e) => {
                const evt = e as unknown as IDBVersionChangeEvent
                expect(evt.oldVersion).toBe(0)
                expect(evt.newVersion).toBe(3)
                expect(evt).toBeInstanceOf(Event)
                openEvents.push({
                    type: "upgradeneeded",
                    oldVersion: evt.oldVersion,
                    newVersion: evt.newVersion,
                })
            }

            openrq.onsuccess = (e) => {
                resolve(e.target!.result as IDBDatabase)
            }

            openrq.onerror = () => reject(openrq.error)
            openrq.onblocked = () => reject(new Error("open blocked"))
        })

        cleanupDbRefAfterTest(db)

        // Listen for versionchange events
        const versionChangeEvents: Array<{
            type: string
            oldVersion: number
            newVersion: number | null
        }> = []
        db.onversionchange = (e) => {
            const evt = e as unknown as IDBVersionChangeEvent
            expect(evt.oldVersion).toBe(3)
            expect(evt.newVersion).toBe(null)
            expect(evt).toBeInstanceOf(Event)
            versionChangeEvents.push({
                type: "versionchange",
                oldVersion: evt.oldVersion,
                newVersion: evt.newVersion,
            })
            versionChangeEventReceived = true
            db.close()
        }

        db.onerror = () => {
            throw new Error("db.error")
        }
        db.onabort = () => {
            throw new Error("db.abort")
        }

        // Wait a bit then delete the database
        await new Promise((resolve) => setTimeout(resolve, 50))

        const deleteEvents: Array<{
            type: string
            oldVersion: number
            newVersion: number | null
        }> = []
        const deleterq = idb.deleteDatabase(dbname)

        const deleteSuccess = await new Promise<IDBVersionChangeEvent>(
            (resolve, reject) => {
                deleterq.onsuccess = (e) => {
                    const evt = e as unknown as IDBVersionChangeEvent
                    resolve(evt)
                }
                deleterq.onerror = () => reject(deleterq.error)
                deleterq.onblocked = () => reject(new Error("delete blocked"))
            },
        )

        expect((deleteSuccess.target as IDBRequest)?.result).toBe(undefined)
        expect(deleteSuccess.oldVersion).toBe(3)
        expect(deleteSuccess.newVersion).toBe(null)
        expect(deleteSuccess).toBeInstanceOf(Event)
        deleteEvents.push({
            type: "delete",
            oldVersion: deleteSuccess.oldVersion,
            newVersion: deleteSuccess.newVersion,
        })

        // Wait for versionchange event to be processed
        await new Promise((resolve) => setTimeout(resolve, 50))

        // Wait a bit then delete a non-existent database
        const deleteNonExistentReq = idb.deleteDatabase("db-does-not-exist")

        const deleteNonExistentSuccess =
            await new Promise<IDBVersionChangeEvent>((resolve, reject) => {
                deleteNonExistentReq.onsuccess = (e) => {
                    const evt = e as unknown as IDBVersionChangeEvent
                    resolve(evt)
                }
                deleteNonExistentReq.onerror = () =>
                    reject(deleteNonExistentReq.error)
                deleteNonExistentReq.onblocked = () =>
                    reject(new Error("delete blocked"))
            })

        expect((deleteNonExistentSuccess.target as IDBRequest)?.result).toBe(
            undefined,
        )
        expect(deleteNonExistentSuccess.oldVersion).toBe(0)
        expect(deleteNonExistentSuccess.newVersion).toBe(null)
        expect(deleteNonExistentSuccess).toBeInstanceOf(Event)

        // Verify all events were fired
        expect(openEvents).toHaveLength(1)
        expect(openEvents[0]).toEqual({
            type: "upgradeneeded",
            oldVersion: 0,
            newVersion: 3,
        })

        expect(versionChangeEventReceived).toBe(true)
        expect(versionChangeEvents).toHaveLength(1)
        expect(versionChangeEvents[0]).toEqual({
            type: "versionchange",
            oldVersion: 3,
            newVersion: null,
        })

        expect(deleteEvents).toHaveLength(1)
        expect(deleteEvents[0]).toEqual({
            type: "delete",
            oldVersion: 3,
            newVersion: null,
        })
    })
})
