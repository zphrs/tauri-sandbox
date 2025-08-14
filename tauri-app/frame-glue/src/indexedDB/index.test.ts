import { FDBFactory } from "./index"
import { describe, expect, test } from "vitest"

import { setupIDBMethodHandlersFromPort } from "./methods"

async function getDatabase(
    name: string,
    onUpgradeNeeded: (db: IDBDatabase) => void,
    version?: number
): Promise<IDBDatabase> {
    const { port1: parent, port2: child } = new MessageChannel()
    setupIDBMethodHandlersFromPort(parent, "test")
    const idb = new FDBFactory(child)
    const request = idb.open(name, version)
    return new Promise((res, rej) => {
        request.onerror = () => {
            console.error(request.error)
            rej(request.error)
        }
        request.onsuccess = () => {
            const db = request.result
            res(db)
        }
        request.onupgradeneeded = (event: Event) => {
            onUpgradeNeeded((event.target as IDBOpenDBRequest).result)
        }
    })
}

describe("indexedDB good path", async () => {
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

    db.onerror = (e) => {
        const target = e.target as IDBRequest<unknown>
        // Generic error handler for all errors targeted at this database's
        // requests!
        throw target.error
    }
    test("get bill", async () => {
        const tx = db.transaction("customers", "readonly")
        const objStore = tx.objectStore("customers")
        const data = await new Promise((res) => {
            const e = objStore.get("444-44-4444")
            e.onsuccess = (e) => {
                res((e.target as IDBRequest<unknown>).result)
            }
        })
        expect(data).toStrictEqual(customerData[0])
    })

    test("customers count", async () => {
        const tx = db.transaction("customers", "readonly")
        const store = tx.objectStore("customers")
        const len = await new Promise((res) => {
            const et = store.count()
            et.onsuccess = () => {
                res(et.result)
            }
        })
        expect(len).toBe(2)
    })

    test("get bill through index", async () => {
        const tx = db.transaction("customers", "readonly")
        const objStore = tx.objectStore("customers")
        const data = await new Promise((res) => {
            const request = objStore
                .index("email")
                .openCursor("bill@company.com")

            request.onsuccess = () => {
                res(request.result?.value)
            }
        })
        expect(data).toStrictEqual(customerData[0])
    })
})
