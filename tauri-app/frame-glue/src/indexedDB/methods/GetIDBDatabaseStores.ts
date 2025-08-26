import { type Method, handleRequests } from "../../rpcOverPorts"
import type { KeyPath } from "../inMemoryIdb/lib/types"
import { openedDbs } from "./OpenIDBDatabase"
import { requestToPromise } from "./readFromStore"

type SerializedIndex = {
    name: string
    keyPath: KeyPath
    multiEntry: boolean
    unique: boolean
}

export type Store = {
    name: string
    parameters: IDBObjectStoreParameters
    indexes: SerializedIndex[]
}

export type GetIDBDatabaseStoresMethod = Method<
    "getIDBDBStores",
    { name: string },
    Store[]
>
export function handleGetIDBDatabaseStores(port: MessagePort, docId: string) {
    handleRequests<GetIDBDatabaseStoresMethod>(
        port,
        "getIDBDBStores",
        async ({ name }) => {
            // first check if it even exists
            if (
                !(await indexedDB.databases()).some(
                    (v) => v.name === `${docId}:${name}`,
                )
            ) {
                return []
            }
            // code block ({}) to reuse db var
            {
                const db = openedDbs[`${docId}:${name}`]
                if (db) {
                    return idbStoresFromDb(db.db)
                }
            }
            const db = await requestToPromise(
                indexedDB.open(`${docId}:${name}`),
            )
            const out = idbStoresFromDb(db)
            db.close()
            return out
        },
    )
}

function idbStoresFromDb(db: IDBDatabase) {
    const names = db.objectStoreNames
    if (names.length === 0) {
        return []
    }
    const tx = db.transaction(names, "readonly")
    const out: GetIDBDatabaseStoresMethod["res"]["result"] = []

    for (const name of names) {
        const store = tx.objectStore(name)
        const indexes: SerializedIndex[] = []
        for (const indexName of store.indexNames) {
            const idx = store.index(indexName)
            indexes.push({
                name: idx.name,
                keyPath: idx.keyPath,
                multiEntry: idx.multiEntry,
                unique: idx.unique,
            })
        }
        out.push({
            name,
            parameters: {
                keyPath: store.keyPath,
                autoIncrement: store.autoIncrement,
            },
            indexes,
        })
    }

    return out
}
