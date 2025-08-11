import { describe, expect, test } from "vitest"

import { setupIDBMethodHandlersFromPort } from "./methods"
import FDBFactory from "./inMemoryIdb/FDBFactory"

async function getDatabase(
    name: string,
    onUpgradeNeeded: (db: IDBDatabase) => void,
    version?: number
): Promise<IDBDatabase> {
    const { port1: parent, port2: child } = new MessageChannel()
    console.log(window.indexedDB)
    setupIDBMethodHandlersFromPort(parent, "test")
    const idb = new FDBFactory(child)
    const request = idb.open(name, version)
    return new Promise((res, rej) => {
        request.onerror = (_event: Event) => {
            console.error(request.error)
            rej(request.error)
        }
        request.onsuccess = (_event: Event) => {
            const db = request.result
            res(db)
        }
        request.onupgradeneeded = (event: Event) => {
            onUpgradeNeeded((event.target as IDBOpenDBRequest).result)
        }
    })
}

describe("indexedDB good path", async (_api) => {
    const customerData = [
        {
            ssn: "444-44-4444",
            name: "Bill",
            age: 35,
            email: "bill@company.com",
        },
        { ssn: "555-55-5555", name: "Donna", age: 32, email: "donna@home.org" },
    ]
    const db = await getDatabase(
        "another",
        (db) => {
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
        },
        3
    )

    db.onerror = (event) => {
        // Generic error handler for all errors targeted at this database's
        // requests!
        throw new Error(
            `Database error: ${(event.target as IDBRequest)?.error}`
        )
    }
    test("get bill", async () => {
        const tx = db.transaction("customers", "readonly")
        const objStore = tx.objectStore("customers")
        let data = await new Promise((res) => {
            let e = objStore.get("444-44-4444")
            e.onsuccess = (e) => {
                res((e.target as IDBRequest<any>).result)
            }
        })
        expect(data).toStrictEqual(customerData[0])
    })
})
