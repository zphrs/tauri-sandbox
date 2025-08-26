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
    cleanupDbRefAfterTest(out)

    return out
}

export async function cleanupDbRefAfterTest(db: IDBDatabase) {
    try {
        onTestFinished(async () => {
            db.close()
            await requestToPromise(
                idb.deleteDatabase(db.name) as unknown as IDBRequest<unknown>,
            )
        })
    } catch {
        afterAll(async () => {
            db.close()
            await requestToPromise(
                idb.deleteDatabase(db.name) as unknown as IDBRequest<unknown>,
            )
        })
    }
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
    cleanupDbRefAfterTest(out)

    return out
}

// Helper function to migrate a named database (equivalent to migrateNamedDatabase in original)
export async function migrateNamedDatabase(
    _t: { id?: string },
    dbname: string,
    newVersion: number,
    onUpgradeNeeded: (db: IDBDatabase, tx: IDBTransaction) => void,
): Promise<IDBDatabase> {
    const req = idb.open(dbname, newVersion)
    req.onupgradeneeded = () => {
        onUpgradeNeeded(
            req.result,
            req.transaction! as unknown as IDBTransaction,
        )
    }
    const out = await requestToPromise(
        req as unknown as IDBRequest<IDBDatabase>,
    )

    cleanupDbRefAfterTest(out)
    return out
}

// Helper function to delete all databases - if called make
// sure that the test which calls it is in the serial directory.
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
