import {
    handleRequests,
    type Method,
    type Notification,
} from "../../rpcOverPorts"
import { performWriteOperation, type Write } from "./executeIDBTransaction"

export type ObjectStoreUpgradeActions =
    | Notification<
          "createIndex",
          {
              name: string
              keyPath: string | string[]
              options?: IDBIndexParameters
          }
      >
    | Notification<"deleteIndex", { name: string }>

export type UpgradeActions =
    | Notification<
          "createObjectStore",
          {
              name: string
              options: IDBObjectStoreParameters
              doOnUpgrade: (ObjectStoreUpgradeActions | Write)[]
          }
      >
    | Notification<"deleteObjectStore", { name: string }>

export type OpenIDBDatabaseMethod = Method<
    "openDatabase",
    { name: string; version?: number; doOnUpgrade: UpgradeActions[] },
    { objectStores: { name: string; parameters: IDBObjectStoreParameters }[] }
>

export const openedDbs: Record<string, IDBDatabase> = {}

export function handleOpenDatabase(port: MessagePort, docId: string) {
    handleRequests<OpenIDBDatabaseMethod>(
        port,
        "openDatabase",
        async ({ name, version, doOnUpgrade }) => {
            const req = indexedDB.open(`${docId}:${name}`, version)
            req.onupgradeneeded = () => {
                const db = req.result
                for (const upgradeAction of doOnUpgrade) {
                    switch (upgradeAction.method) {
                        case "createObjectStore": {
                            const { name, options } = upgradeAction.params

                            const store = db.createObjectStore(name, options)
                            handleObjectStoreActions(
                                upgradeAction.params.doOnUpgrade,
                                store
                            )
                            break
                        }
                        case "deleteObjectStore": {
                            let { name } = upgradeAction.params
                            if (
                                db.transaction(name).objectStore(name)
                                    .keyPath === null
                            ) {
                                db.deleteObjectStore(`${name}:metadata`)
                                name = `${name}:main`
                            }
                            db.deleteObjectStore(name)
                            break
                        }
                    }
                }
            }
            return new Promise((res) => {
                req.onsuccess = () => {
                    const db = req.result
                    openedDbs[`${docId}:${name}`] = db
                    const names = db.objectStoreNames
                    const tx = db.transaction(names, "readonly")
                    const out: OpenIDBDatabaseMethod["res"]["result"]["objectStores"] =
                        []

                    for (const name of names) {
                        const store = tx.objectStore(name)
                        out.push({
                            name,
                            parameters: {
                                keyPath: store.keyPath,
                                autoIncrement: store.autoIncrement,
                            },
                        })
                    }

                    res({ objectStores: out })
                }
            })
        }
    )
}

function handleObjectStoreActions(
    doOnUpgrade: (ObjectStoreUpgradeActions | Write)[],
    store: IDBObjectStore
) {
    for (const ua of doOnUpgrade) {
        switch (ua.method) {
            case "createIndex": {
                const { name, keyPath, options } = ua.params
                store.createIndex(name, keyPath, options)
                break
            }
            case "deleteIndex": {
                const { name } = ua.params
                store.deleteIndex(name)
                break
            }
            default: {
                performWriteOperation(ua, store)
                break
            }
        }
    }
}
