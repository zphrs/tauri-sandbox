import { describe, expect, test } from "vitest"
import {
    createDatabase,
    requestToPromise,
} from "./w3c-vitest-tests/resources/createDatabase"

describe("good path", async () => {
    const customerData = [
        {
            ssn: "444-44-4444",
            name: "Bill",
            age: 35,
            email: "bill@company.com",
        },
        { ssn: "555-55-5555", name: "Donna", age: 32, email: "donna@home.org" },
    ]
    const db = await createDatabase({ id: "database" }, (db) => {
        const objStore = db.createObjectStore("customers", {
            keyPath: "ssn",
        })

        objStore.createIndex("name", "name", { unique: false })

        objStore.createIndex("email", "email", { unique: true })

        customerData.forEach((customer) => {
            objStore.add(customer)
        })

        // Use transaction oncomplete to make sure the objectStore creation is
        // finished before adding data into it.
        // objStore.transaction.oncomplete = (event) => {
        //     // Store values in the newly created objectStore.
        //     const objStore = db
        //         .transaction("customers", "readwrite")
        //         .objectStore("customers")
        //     customerData.forEach((customer) => {
        //         objStore.add(customer)
        //     })
        // }
    })

    db.onerror = (e) => {
        const target = e.target as IDBRequest<unknown>
        // Generic error handler for all errors targeted at this database's
        // requests!
        throw target.error
    }
    test("get bill", async () => {
        const tx = db.transaction("customers", "readonly")
        const objStore = tx.objectStore("customers")
        const data = await requestToPromise(objStore.get("444-44-4444"))
        expect(data).toStrictEqual(customerData[0])
    })

    test("customers count", async () => {
        const tx = db.transaction("customers", "readonly")
        const store = tx.objectStore("customers")
        const len = await requestToPromise(store.count())
        expect(len).toBe(2)
    })

    test("get bill through index", async () => {
        const tx = db.transaction("customers", "readonly")
        const objStore = tx.objectStore("customers")
        const data = await requestToPromise(
            objStore.index("email").get("bill@company.com"),
        )
        expect(data).toStrictEqual(customerData[0])
    })
})

describe("index", async () => {
    const records = ["Alice", "Alice", "Bob"]

    const onUpgradeNeeded = (db: IDBDatabase): void => {
        const store = db.createObjectStore("table", { autoIncrement: true })
        store.createIndex("name", "")
        for (const record of records) {
            store.add(record)
        }
    }

    test("get all", async ({ task }) => {
        const db = await createDatabase(task, onUpgradeNeeded)
        {
            const tx = db.transaction("table", "readonly")
            const allRecords = await requestToPromise(
                tx.objectStore("table").getAll(null),
            )
            expect(allRecords).toStrictEqual(records)
        }
        {
            const tx = db.transaction("table", "readonly")
            const allRecords = await requestToPromise(
                tx.objectStore("table").index("name").getAll(null),
            )
            expect(allRecords).toStrictEqual(records)
        }
    })

    test("get alices", async ({ task }) => {
        const db = await createDatabase(task, onUpgradeNeeded)

        const tx = db.transaction("table", "readonly")
        const allRecords = await requestToPromise(
            tx.objectStore("table").index("name").getAll("Alice"),
        )
        expect(allRecords).toStrictEqual(records.slice(0, 2))
    })
    test("get a bob", async ({ task }) => {
        const db = await createDatabase(task, onUpgradeNeeded)

        const tx = db.transaction("table", "readonly")
        const allRecords = await requestToPromise(
            tx.objectStore("table").index("name").getAll("Bob"),
        )
        expect(allRecords).toStrictEqual(records.slice(2))
    })

    test("change an alice to a bob", async ({ task }) => {
        const db = await createDatabase(task, onUpgradeNeeded)

        const tx = db.transaction("table", "readwrite")
        const allRecords = await requestToPromise(
            tx.objectStore("table").index("name").getAll(null),
        )
        expect(allRecords).toStrictEqual(records)
        await requestToPromise(tx.objectStore("table").put("Bob", 2))

        const alices = await requestToPromise(
            tx.objectStore("table").index("name").getAll("Alice"),
        )
        expect(alices).toStrictEqual(["Alice"])

        const bobs = await requestToPromise(
            tx.objectStore("table").index("name").getAll("Bob"),
        )
        expect(bobs).toStrictEqual(["Bob", "Bob"])
    })
    test("delete an alice", async ({ task }) => {
        const db = await createDatabase(task, onUpgradeNeeded)

        const tx = db.transaction("table", "readwrite")
        const allRecords = await requestToPromise(
            tx.objectStore("table").index("name").getAll(null),
        )
        expect(allRecords).toStrictEqual(records)
        await requestToPromise(tx.objectStore("table").delete(1))

        const alices = await requestToPromise(
            tx.objectStore("table").index("name").getAll("Alice"),
        )
        expect(alices).toStrictEqual(["Alice"])

        const bobs = await requestToPromise(
            tx.objectStore("table").index("name").getAll("Bob"),
        )
        expect(bobs).toStrictEqual(["Bob"])
    })
    test("delete a bob", async ({ task }) => {
        const db = await createDatabase(task, onUpgradeNeeded)

        const tx = db.transaction("table", "readwrite")
        const allRecords = await requestToPromise(
            tx.objectStore("table").index("name").getAll(null),
        )
        expect(allRecords).toStrictEqual(records)
        await requestToPromise(tx.objectStore("table").delete(3))

        const alices = await requestToPromise(
            tx.objectStore("table").index("name").getAll("Alice"),
        )
        expect(alices).toStrictEqual(["Alice", "Alice"])

        const bobs = await requestToPromise(
            tx.objectStore("table").index("name").getAll("Bob"),
        )
        expect(bobs).toStrictEqual([])
    })
})
