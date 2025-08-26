import { describe, expect, test } from "vitest"
import {
    idb,
    createNamedDatabase,
    migrateNamedDatabase,
    deleteAllDatabases,
} from "../resources/createDatabase"

function sleep_sync(msec: number): void {
    const start = new Date().getTime()
    while (new Date().getTime() - start < msec) {
        /* empty */
    }
}

describe("Get databases()", () => {
    test("Ensure that databases() returns a promise", async () => {
        const result = idb.databases()
        expect(
            result instanceof Promise,
            "databases() should return a promise",
        ).toBe(true)
        await result.catch(() => {}) // Prevent unhandled rejection
    })

    test("Enumerate one database", async ({ task }) => {
        await deleteAllDatabases()

        const db_name = task.id + "TestDatabase"
        await createNamedDatabase(task, db_name, () => {})
        const databases_result = await idb.databases()
        const expected_result = { name: db_name, version: 1 }

        expect(
            databases_result.length,
            "The result of databases() should contain one result per database",
        ).toBe(1)
        expect(databases_result[0].name).toBe(expected_result.name)
        expect(
            databases_result[0].version,
            "Database version should match",
        ).toBe(expected_result.version)
    })

    test("Enumerate multiple databases", async ({ task }) => {
        // Delete any databases that may not have been cleaned up after previous test
        // runs.
        await deleteAllDatabases()

        const db_name1 = task.id + "TestDatabase1"
        const db_name2 = task.id + "TestDatabase2"
        const db_name3 = task.id + "TestDatabase3"
        const db1 = await createNamedDatabase(task, db_name1, () => {})
        const db2 = await createNamedDatabase(task, db_name2, () => {})
        const db3 = await createNamedDatabase(task, db_name3, () => {})
        db1.close()
        db2.close()
        db3.close()
        await migrateNamedDatabase(task, db_name2, 2, () => {})

        const databases_result = await idb.databases()
        const expected_result = [
            { name: db_name1, version: 1 },
            { name: db_name2, version: 2 },
            { name: db_name3, version: 1 },
        ]

        for (let i = 0; i < expected_result.length; i += 1) {
            const result = expected_result[i]
            expect(databases_result).toContainEqual(result)
        }
    })

    test("Ensure that databases() doesn't pick up changes that haven't committed", async ({
        task,
    }) => {
        await deleteAllDatabases()

        const db1 = await createNamedDatabase(task, task.id + "DB1", () => {})

        let databases_promise1: Promise<IDBDatabaseInfo[]>

        const db2 = await createNamedDatabase(
            task,
            task.id + "DB2",
            async () => {
                databases_promise1 = idb.databases()

                // Give databases() operation a chance to fetch all current info about
                // existing databases. This must be a sync sleep since await would trigger
                // auto commit of the upgrade transaction.
                sleep_sync(100)
            },
        )

        const databases_result1 = await databases_promise1!
        const foundDB1 = databases_result1.find(
            (db) => db.name === task.id + "DB1",
        )
        expect(
            foundDB1,
            "DB1 should exist when databases() was called",
        ).toBeDefined()
        expect(databases_result1.length).toBe(1)

        db1.close()
        db2.close()

        const databases_result2 = await idb.databases()
        expect(databases_result2.length).toBe(2)

        let databases_promise3: Promise<IDBDatabaseInfo[]>

        await migrateNamedDatabase(task, task.id + "DB2", 2, async () => {
            databases_promise3 = idb.databases()

            // Give databases() operation a chance to fetch all current info about
            // existing databases. This must be a sync sleep since await would trigger
            // auto commit of the upgrade transaction.
            sleep_sync(100)
        })

        const databases_result3 = await databases_promise3!

        expect(
            databases_result3[0]?.version,
            "The result of databases() should contain the version of DB2 " +
                "at the time of calling, not the new version being upgraded to",
        ).toBe(1)
        expect(
            databases_result3[1]?.version,
            "The result of databases() should contain the version of DB2 " +
                "at the time of calling, not the new version being upgraded to",
        ).toBe(1)
    })

    test("Make sure an empty list is returned for the case of no databases", async ({
        task,
    }) => {
        // Add some databases and close their connections
        const db1 = await createNamedDatabase(task, task.id + "DB1", () => {})
        const db2 = await createNamedDatabase(task, task.id + "DB2", () => {})
        db1.close()
        db2.close()

        await deleteAllDatabases()

        // Make sure the databases are no longer returned
        const databases_result = await idb.databases()

        // Check that our test databases are not in the result
        const foundDB1 = databases_result.find(
            (db) => db.name === task.id + "DB1",
        )
        const foundDB2 = databases_result.find(
            (db) => db.name === task.id + "DB2",
        )

        expect(foundDB1, "DB1 should not be in the results").toBeUndefined()
        expect(foundDB2, "DB2 should not be in the results").toBeUndefined()
    })
})
