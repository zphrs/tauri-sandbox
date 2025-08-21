import { afterAll, onTestFinished } from "vitest"
import { FDBFactory } from "../../index"
import { setupIDBMethodHandlersFromPort } from "../../methods"
import { requestToPromise } from "../../methods/readFromStore"

export { requestToPromise }

function setupPort() {
    const { port1: parent, port2: child } = new MessageChannel()
    setupIDBMethodHandlersFromPort(parent, "test")
    return child
}

export const idb = new FDBFactory(setupPort())

// Helper function to create a database with a name for the testsuite
// (like createDatabase in original)
export async function createDatabase(
    t: { id?: string },
    onUpgradeNeeded: (db: IDBDatabase) => void,
): Promise<IDBDatabase> {
    const dbName = t.id
    const dbname = dbName || "testdb-" + new Date().getTime() + Math.random()
    const req = idb.open(dbname)
    req.onupgradeneeded = () => {
        onUpgradeNeeded(req.result)
    }
    const out = await requestToPromise(
        req as unknown as IDBRequest<IDBDatabase>,
    )
    try {
        onTestFinished(() => {
            out.close()
            idb.deleteDatabase(dbname)
        })
    } catch {
        afterAll(() => {
            out.close()
            idb.deleteDatabase(dbname)
        })
    }

    return out
}

// Helper function to create a named database (equivalent to createNamedDatabase in original)
export async function createNamedDatabase(
    _t: { id?: string },
    dbname: string,
    onUpgradeNeeded: (db: IDBDatabase) => void,
): Promise<IDBDatabase> {
    // First delete the database if it exists
    await requestToPromise(idb.deleteDatabase(dbname) as unknown as IDBRequest)

    const req = idb.open(dbname, 1)
    req.onupgradeneeded = () => {
        onUpgradeNeeded(req.result)
    }
    const out = await requestToPromise(
        req as unknown as IDBRequest<IDBDatabase>,
    )
    try {
        onTestFinished(() => {
            out.close()
            idb.deleteDatabase(dbname)
        })
    } catch {
        afterAll(() => {
            out.close()
            idb.deleteDatabase(dbname)
        })
    }

    return out
}

// Helper function to migrate a named database (equivalent to migrateNamedDatabase in original)
export async function migrateNamedDatabase(
    _t: { id?: string },
    dbname: string,
    newVersion: number,
    onUpgradeNeeded: (db: IDBDatabase) => void,
): Promise<IDBDatabase> {
    const req = idb.open(dbname, newVersion)
    req.onupgradeneeded = () => {
        onUpgradeNeeded(req.result)
    }
    const out = await requestToPromise(
        req as unknown as IDBRequest<IDBDatabase>,
    )

    return out
}

// Helper function to delete all databases
export async function deleteAllDatabases(): Promise<void> {
    const databases = await idb.databases()
    for (const dbInfo of databases) {
        if (dbInfo.name) {
            await requestToPromise(
                idb.deleteDatabase(dbInfo.name) as unknown as IDBRequest,
            )
        }
    }
}
