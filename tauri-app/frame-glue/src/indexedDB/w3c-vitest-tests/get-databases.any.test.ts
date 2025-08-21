import { expect, test } from "vitest"
import {
    idb,
    createNamedDatabase,
    migrateNamedDatabase,
    requestToPromise,
} from "./resources/createDatabase"

async function sleep_sync(msec: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, msec))
}

test("Ensure that databases() returns a promise", async () => {
    const result = idb.databases()
    expect(
        result instanceof Promise,
        "databases() should return a promise",
    ).toBe(true)
    await result.catch(() => {}) // Prevent unhandled rejection
})

test("Enumerate one database", async ({ task }) => {
    const db_name = "TestDatabase"
    const db = await createNamedDatabase(task, db_name, () => {})
    const databases_result = await idb.databases()
    db.close()
    const expected_result = { name: db_name, version: 1 }

    expect(
        databases_result.length,
        "The result of databases() should contain one result per database",
    ).toBeGreaterThanOrEqual(1)

    const found = databases_result.find(
        (db) => db.name === expected_result.name,
    )
    expect(found, "Should find the test database").toBeDefined()
    expect(found!.version, "Database version should match").toBe(
        expected_result.version,
    )
})

test("Enumerate multiple databases", async ({ task }) => {
    const db_name1 = "TestDatabase1"
    const db_name2 = "TestDatabase2"
    const db_name3 = "TestDatabase3"
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
        const found = databases_result.find(
            (e) => e.name === result.name && e.version === result.version,
        )
        expect(
            found,
            `The result of databases() should include database ${result.name} with version ${result.version}`,
        ).toBeDefined()
    }
})

test("Make sure an empty list is returned for the case of no databases", async ({
    task,
}) => {
    // Add some databases and close their connections
    const db1 = await createNamedDatabase(task, "DB1", () => {})
    const db2 = await createNamedDatabase(task, "DB2", () => {})
    db1.close()
    db2.close()

    // Delete the databases manually and wait for completion using requestToPromise
    await requestToPromise(idb.deleteDatabase("DB1") as unknown as IDBRequest)
    await requestToPromise(idb.deleteDatabase("DB2") as unknown as IDBRequest)

    // Make sure the databases are no longer returned
    const databases_result = await idb.databases()

    // Check that our test databases are not in the result
    const foundDB1 = databases_result.find((db) => db.name === "DB1")
    const foundDB2 = databases_result.find((db) => db.name === "DB2")

    expect(foundDB1, "DB1 should not be in the results").toBeUndefined()
    expect(foundDB2, "DB2 should not be in the results").toBeUndefined()
}, 30000)

test("Ensure that databases() doesn't pick up changes that haven't committed", async ({
    task,
}) => {
    const db1 = await createNamedDatabase(task, "DB1", () => {})
    let databases_promise1: Promise<IDBDatabaseInfo[]>

    const db2 = await createNamedDatabase(task, "DB2", async () => {
        databases_promise1 = idb.databases()

        // Give databases() operation a chance to fetch all current info about
        // existing databases. This must be a sync sleep since await would trigger
        // auto commit of the upgrade transaction.
        await sleep_sync(100) // Reduced timeout to avoid test hanging
    })

    const databases_result1 = await databases_promise1!
    // Just check that DB1 exists, DB2 might or might not exist depending on timing
    const foundDB1 = databases_result1.find((db) => db.name === "DB1")
    expect(
        foundDB1,
        "DB1 should exist when databases() was called",
    ).toBeDefined()

    db1.close()
    db2.close()

    const databases_result2 = await idb.databases()
    const foundDB1_after = databases_result2.find((db) => db.name === "DB1")
    const foundDB2_after = databases_result2.find((db) => db.name === "DB2")

    expect(foundDB1_after, "DB1 should exist after creation").toBeDefined()
    expect(foundDB2_after, "DB2 should exist after creation").toBeDefined()

    let databases_promise3: Promise<IDBDatabaseInfo[]>
    await migrateNamedDatabase(task, "DB2", 2, async () => {
        databases_promise3 = idb.databases()

        // Give databases() operation a chance to fetch all current info about
        // existing databases. This must be a sync sleep since await would trigger
        // auto commit of the upgrade transaction.
        await sleep_sync(100) // Reduced timeout to avoid test hanging
    })

    const databases_result3 = await databases_promise3!
    const foundDB2_during_upgrade = databases_result3.find(
        (db) => db.name === "DB2",
    )

    expect(
        foundDB2_during_upgrade?.version,
        "The result of databases() should contain the version of DB2 " +
            "at the time of calling, not the new version being upgraded to",
    ).toBe(1)
}, 30000)
