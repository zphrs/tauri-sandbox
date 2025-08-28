import { describe, expect, test } from "vitest"
import {
    idb,
    requestToPromise,
    cleanupDbRefAfterTest,
} from "../resources/createDatabase"

// Port of w3c test: idbrequest-onupgradeneeded.any.js
// Tests IDBRequest onupgradeneeded event handling

describe("IDBRequest onupgradeneeded", () => {
    test("indexedDB.delete called from upgradeneeded handler", async ({
        task,
    }) => {
        const dbName = task.id || "test-db"
        const order: string[] = []

        // Delete any existing database
        const deleteReq = idb.deleteDatabase(dbName)
        await requestToPromise(deleteReq as unknown as IDBRequest<unknown>)

        const openReq = idb.open(dbName)
        const deletePromise = new Promise<void>((resolve, reject) => {
            openReq.onupgradeneeded = () => {
                cleanupDbRefAfterTest(openReq.result)
                order.push("Upgrade")
                const db = openReq.result
                const deleteRequest = idb.deleteDatabase(db.name)
                deleteRequest.onsuccess = () => {
                    expect(order).toEqual(["Upgrade", "Open Success"])
                    resolve()
                }
                deleteRequest.onerror = () => {
                    reject(new Error("delete failed"))
                }
            }
            openReq.onsuccess = () => {
                const db = openReq.result
                db.close()
                order.push("Open Success")
            }
            openReq.onerror = () => {
                reject(new Error("open failed"))
            }
        })

        await deletePromise
    })

    test("Abort transaction before deleting database in upgradeneeded handler", async ({
        task,
    }) => {
        const dbName = task.id || "test-db-2"
        const order: string[] = []

        // Delete any existing database
        const deleteReq = idb.deleteDatabase(dbName)
        await requestToPromise(deleteReq as unknown as IDBRequest<unknown>)

        const openReq = idb.open(dbName)
        const deletePromise = new Promise<void>((resolve, reject) => {
            openReq.onupgradeneeded = () => {
                order.push("Upgrade")
                openReq.transaction!.abort()
                order.push("Upgrade Transaction Aborted")
                const db = openReq.result
                const deleteRequest = idb.deleteDatabase(db.name)
                deleteRequest.onsuccess = () => {
                    expect(order).toEqual([
                        "Upgrade",
                        "Upgrade Transaction Aborted",
                        "Open Error",
                    ])
                    resolve()
                }
                deleteRequest.onerror = () => {
                    reject(new Error("delete failed"))
                }
            }
            openReq.onsuccess = () => {
                reject(new Error("open should not succeed"))
            }
            openReq.onerror = () => {
                expect(order).toEqual([
                    "Upgrade",
                    "Upgrade Transaction Aborted",
                ])
                order.push("Open Error")
            }
        })

        await deletePromise
    })

    test("Abort transaction after deleting database in upgradeneeded event handler", async ({
        task,
    }) => {
        const dbName = task.id || "test-db-3"
        const order: string[] = []

        // Delete any existing database
        const deleteReq = idb.deleteDatabase(dbName)
        await requestToPromise(deleteReq as unknown as IDBRequest<unknown>)

        const openReq = idb.open(dbName)
        const deletePromise = new Promise<void>((resolve, reject) => {
            openReq.onupgradeneeded = () => {
                order.push("Upgrade")
                const db = openReq.result
                const deleteRequest = idb.deleteDatabase(db.name)
                openReq.transaction!.abort()
                order.push("Upgrade Transaction Aborted")
                deleteRequest.onsuccess = () => {
                    expect(order).toEqual([
                        "Upgrade",
                        "Upgrade Transaction Aborted",
                        "Open Error",
                    ])
                    resolve()
                }
                deleteRequest.onerror = () => {
                    reject(new Error("delete failed"))
                }
            }
            openReq.onsuccess = () => {
                reject(new Error("open should not succeed"))
            }
            openReq.onerror = () => {
                expect(order).toEqual([
                    "Upgrade",
                    "Upgrade Transaction Aborted",
                ])
                order.push("Open Error")
            }
        })

        await deletePromise
    })

    test("transaction oncomplete ordering relative to open request onsuccess", async ({
        task,
    }) => {
        const dbName = task.id || "test-db-4"
        const order: string[] = []

        // Delete any existing database
        const deleteReq = idb.deleteDatabase(dbName)
        await requestToPromise(deleteReq as unknown as IDBRequest<unknown>)

        const openReq = idb.open(dbName)
        const completePromise = new Promise<void>((resolve, reject) => {
            openReq.onupgradeneeded = () => {
                cleanupDbRefAfterTest(openReq.result)
                order.push("Upgrade")
                const db = openReq.result
                db.createObjectStore("store")
                openReq.transaction!.oncomplete = () => {
                    order.push("Upgrade transaction complete")
                    const txn = db.transaction("store", "readwrite")
                    const store = txn.objectStore("store")
                    store.put("value", "key")
                    txn.oncomplete = () => {
                        expect(order).toEqual([
                            "Upgrade",
                            "Upgrade transaction complete",
                            "Open Success",
                        ])
                        resolve()
                    }
                    txn.onerror = () => {
                        reject(new Error("error on transaction"))
                    }
                    txn.onabort = () => {
                        reject(new Error("aborting transaction"))
                    }
                }
            }
            openReq.onsuccess = () => {
                order.push("Open Success")
            }
            openReq.onerror = () => {
                reject(new Error("open failed"))
            }
        })

        await completePromise
    })
})
