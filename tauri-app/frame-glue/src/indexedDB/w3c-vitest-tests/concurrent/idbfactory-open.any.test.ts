import {
    idb,
    requestToPromise,
    createDatabase,
    migrateNamedDatabase,
} from "../resources/createDatabase"
import { describe, test, expect } from "vitest"

describe("IDBFactory.open()", () => {
    test("request has no source", async ({ task }) => {
        const name = task.id
        const req = idb.open(name, 9)
        req.onupgradeneeded = () => {}
        const evt = await new Promise<Event & { target: IDBOpenDBRequest }>(
            (resolve, reject) => {
                req.onerror = () => reject(req.error)
                req.onsuccess = (e) =>
                    resolve(e as Event & { target: IDBOpenDBRequest })
            },
        )
        expect(evt.target.source).toBeNull()
    })

    test('database "name" and "version" are correctly set', async ({
        task,
    }) => {
        const name = `${task.id}-db`
        const req = idb.open(name, 13)
        req.onupgradeneeded = () => {}
        const db = await requestToPromise(
            req as unknown as IDBRequest<IDBDatabase>,
        )
        expect(db.name).toBe(name)
        expect(db.version).toBe(13)
        db.close()
    })

    test("no version opens current database", async ({ task }) => {
        const name = task.id
        let db = await migrateNamedDatabase(task, name, 13, () => {})
        db.close()
        db = await requestToPromise(
            idb.open(name) as unknown as IDBRequest<IDBDatabase>,
        )
        expect(db.version).toBe(13)
        db.close()
    })

    test("new database has default version", async ({ task }) => {
        const db = await createDatabase(task, () => {})
        expect(db.version).toBe(1)
        db.close()
    })

    test("new database is empty", async ({ task }) => {
        const db = await createDatabase(task, () => {})
        expect(db.objectStoreNames.length).toBe(0)
        db.close()
    })

    test("open database with a lower version than current throws VersionError", async ({
        task,
    }) => {
        const name = task.id
        await migrateNamedDatabase(task, name, 13, () => {})
        const req = idb.open(name, 12)
        await new Promise<void>((resolve) => {
            req.onerror = () => {
                expect(req.error!.name).toBe("VersionError")
                resolve()
            }
        })
    })

    test(
        "open database with a higher version than current upgrades version",
        { timeout: 2000 },
        async ({ task }) => {
            const name = task.id
            let db = await migrateNamedDatabase(task, name, 13, () => {})
            let didUpgrade = false
            db.close()
            const req = idb.open(name, 14)
            req.onupgradeneeded = () => {
                didUpgrade = true
            }
            db = await requestToPromise(
                req as unknown as IDBRequest<IDBDatabase>,
            )
            expect(didUpgrade).toBe(true)
            expect(db.version).toBe(14)
            db.close()
        },
    )

    test("error in version change transaction aborts open", async ({
        task,
    }) => {
        const name = task.id
        const req = idb.open(name, 1)
        req.onupgradeneeded = (e) => {
            e.target.transaction.abort()
        }
        await new Promise<void>((resolve) => {
            req.onerror = () => {
                expect(req.error!.name).toBe("AbortError")
                resolve()
            }
        })
    })

    const badVersions: unknown[] = [
        -1,
        -0.5,
        0,
        0.5,
        0.8,
        Number.MAX_SAFE_INTEGER + 1,
        NaN,
        Infinity,
        -Infinity,
        "foo",
        null,
        false,
    ]
    badVersions.forEach((version) => {
        test(`calling open() with version argument ${String(
            version,
        )} should throw TypeError`, () => {
            // cast version to number to bypass TS typing while preserving runtime value
            expect(() =>
                idb.open("test", version as unknown as number),
            ).toThrow(TypeError)
        })
    })
})
