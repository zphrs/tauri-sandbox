import { describe, expect, test } from "vitest"
import {
    createNamedDatabase,
    migrateNamedDatabase,
} from "../resources/createDatabase"
import { FDBKeyRange as IDBKeyRange } from "../../inMemoryIdb"

// Port of w3c test: name-scopes.any.js
// Tests scoping for database / object store / index names, and index keys

// Creates the structure inside a test database.
//
// The structure includes two stores with identical indexes and nearly-similar
// records. The records differ in the "path" attribute values, which are used to
// verify that IndexedDB returns the correct records when queried.
//
// databaseName appears redundant, but we don't want to rely on database.name.
const buildStores = (
    database: IDBDatabase,
    databaseName: string,
    useUniqueKeys: boolean,
) => {
    for (const storeName of ["x", "y"]) {
        const store = database.createObjectStore(storeName, {
            keyPath: "pKey",
            autoIncrement: true,
        })
        for (const indexName of ["x", "y"]) {
            store.createIndex(indexName, `${indexName}Key`, {
                unique: useUniqueKeys,
            })
        }

        for (const xKeyRoot of ["x", "y"]) {
            for (const yKeyRoot of ["x", "y"]) {
                let xKey: string, yKey: string
                if (useUniqueKeys) {
                    xKey = `${xKeyRoot}${yKeyRoot}`
                    yKey = `${yKeyRoot}${xKeyRoot}`
                } else {
                    xKey = xKeyRoot
                    yKey = yKeyRoot
                }
                const path = `${databaseName}-${storeName}-${xKeyRoot}-${yKeyRoot}`
                store.put({ xKey: xKey, yKey: yKey, path: path })
            }
        }
    }
}

// Creates two databases with identical structures.
const buildDatabases = async (
    testCase: { id?: string },
    useUniqueKeys: boolean,
) => {
    const db1 = await createNamedDatabase(testCase, "x", (database) =>
        buildStores(database, "x", useUniqueKeys),
    )
    db1.close()

    const db2 = await createNamedDatabase(testCase, "y", (database) =>
        buildStores(database, "y", useUniqueKeys),
    )
    db2.close()
}

// Reads all the store's values using an index.
//
// Returns a Promise that resolves with an array of values.
const readIndex = async (
    index: IDBIndex,
): Promise<Record<string, unknown>[]> => {
    return new Promise((resolve, reject) => {
        const results: Record<string, unknown>[] = []
        const request = index.openCursor(IDBKeyRange.bound("a", "z"), "next")
        request.onsuccess = () => {
            const cursor = request.result
            if (cursor) {
                results.push(cursor.value)
                cursor.continue()
            } else {
                resolve(results)
            }
        }
        request.onerror = () => reject(request.error)
    })
}

// Opens a named database with a specific version
const openNamedDatabase = async (
    testCase: { id?: string },
    databaseName: string,
    version: number,
): Promise<IDBDatabase> => {
    const db = await migrateNamedDatabase(
        testCase,
        databaseName,
        version,
        () => {
            // No migration needed, just opening existing database
        },
    )
    return db
}

// Verifies that a database contains the expected records.
const checkDatabaseContent = async (
    database: IDBDatabase,
    databaseName: string,
    usedUniqueKeys: boolean,
) => {
    const promises: Promise<void>[] = []
    const transaction = database.transaction(["x", "y"], "readonly")

    for (const storeName of ["x", "y"]) {
        const store = transaction.objectStore(storeName)
        for (const indexName of ["x", "y"]) {
            const index = store.index(indexName)

            const promise = readIndex(index).then((results) => {
                expect(
                    results
                        .map((result) => `${result.path}:${result.pKey}`)
                        .sort(),
                ).toEqual([
                    `${databaseName}-${storeName}-x-x:1`,
                    `${databaseName}-${storeName}-x-y:2`,
                    `${databaseName}-${storeName}-y-x:3`,
                    `${databaseName}-${storeName}-y-y:4`,
                ])

                const expectedKeys = usedUniqueKeys
                    ? ["xx:xx", "xy:yx", "yx:xy", "yy:yy"]
                    : ["x:x", "x:y", "y:x", "y:y"]

                expect(
                    results
                        .map((result) => `${result.xKey}:${result.yKey}`)
                        .sort(),
                ).toEqual(expectedKeys)

                expect(
                    results.map((result) => result[`${indexName}Key`]),
                ).toEqual(
                    results.map((result) => result[`${indexName}Key`]).sort(),
                )
            })
            promises.push(promise)
        }
    }

    await Promise.all(promises)
    return database
}

describe("name-scopes", () => {
    test("Non-unique index keys", async ({ task }) => {
        await buildDatabases(task, false)

        const db1 = await openNamedDatabase(task, "x", 1)
        await checkDatabaseContent(db1, "x", false)
        db1.close()

        const db2 = await openNamedDatabase(task, "y", 1)
        await checkDatabaseContent(db2, "y", false)
        db2.close()
    })

    test("Unique index keys", async ({ task }) => {
        await buildDatabases(task, true)

        const db1 = await openNamedDatabase(task, "x", 1)
        await checkDatabaseContent(db1, "x", true)
        db1.close()

        const db2 = await openNamedDatabase(task, "y", 1)
        await checkDatabaseContent(db2, "y", true)
        db2.close()
    })
})
