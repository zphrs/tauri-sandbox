import {
    handleRequests,
    type Method,
    type Notification,
} from "../../rpcOverPorts"
import type { KeyPath } from "../inMemoryIdb/lib/types"
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
    | Notification<"renameObjectStore", { newName: string }>
    | Notification<"deleteIndex", { name: string }>
    | Notification<"modifyIndex", { name: string; newName: string }>

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
    | Notification<
          "modifyObjectStore",
          {
              name: string
              doOnUpgrade: (ObjectStoreUpgradeActions | Write)[]
          }
      >

export type OpenIDBDatabaseMethod = Method<
    "openDatabase",
    { name: string; version?: number; doOnUpgrade: UpgradeActions[] },
    {
        objectStores: {
            name: string
            parameters: IDBObjectStoreParameters
            indexes: {
                name: string
                parameters: IDBIndexParameters
                keyPath: KeyPath
            }[]
        }[]
    }
>

export const openedDbs: Record<string, { db: IDBDatabase; count: number }> = {}

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
                                store,
                            )
                            break
                        }
                        case "deleteObjectStore": {
                            const { name } = upgradeAction.params
                            db.deleteObjectStore(name)
                            break
                        }
                        case "modifyObjectStore": {
                            const { name, doOnUpgrade } = upgradeAction.params
                            const store = req.transaction!.objectStore(name)
                            handleObjectStoreActions(doOnUpgrade, store)
                        }
                    }
                }
            }
            return new Promise((res, rej) => {
                req.onsuccess = () => {
                    const db = req.result
                    let openedDb = openedDbs[`${docId}:${name}`]
                    if (openedDb) {
                        openedDb.db.close()
                    }
                    if (!openedDb) {
                        openedDbs[`${docId}:${name}`] = openedDb = {
                            db,
                            count: 0,
                        }
                    }
                    openedDb.count++
                    const names = db.objectStoreNames
                    if (names.length === 0) {
                        res({ objectStores: [] })
                        return
                    }
                    const out: OpenIDBDatabaseMethod["res"]["result"]["objectStores"] =
                        []
                    const tx = db.transaction(names, "readonly")

                    for (const name of names) {
                        const store = tx.objectStore(name)
                        out.push({
                            name,
                            parameters: {
                                keyPath: store.keyPath,
                                autoIncrement: store.autoIncrement,
                            },
                            indexes: [...store.indexNames].map((name) => {
                                const index = store.index(name)
                                return {
                                    name,
                                    parameters: {
                                        multiEntry: index.multiEntry,
                                        unique: index.unique,
                                    },
                                    keyPath: index.keyPath,
                                }
                            }),
                        })
                    }
                    res({ objectStores: out })
                }
                req.onerror = () => {
                    rej(req.error)
                }
            })
        },
    )
}

function handleObjectStoreActions(
    doOnUpgrade: (ObjectStoreUpgradeActions | Write)[],
    store: IDBObjectStore,
) {
    for (const ua of doOnUpgrade) {
        switch (ua.method) {
            case "renameObjectStore": {
                const { newName } = ua.params
                store.name = newName
                break
            }
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
            case "modifyIndex": {
                const { name, newName } = ua.params
                store.index(name).name = newName
                break
            }
            default: {
                performWriteOperation(ua, store).then((opReq) => {
                    opReq.onerror = (e) => {
                        console.warn("error while executing write op: ", e)
                        e.preventDefault()
                    }
                })
                break
            }
        }
    }
}
