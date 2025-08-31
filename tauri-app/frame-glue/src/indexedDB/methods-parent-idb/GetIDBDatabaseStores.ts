import { handleRequests } from "../../rpcOverPorts"
import type { Handlers } from "../methods-scaffolding/setupIDBMethodHandlers"

import type {
    GetDatabaseStoresMethod,
    SerializedIndex,
} from "../methods-scaffolding/types/"
import { openedDbs } from "./OpenDatabase"
import { requestToPromise } from "./readFromStore"

export const getDatabaseStoresHandler: Handlers["getDatabaseStores"] = async (
    docId,
    { name },
) => {
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
    const db = await requestToPromise(indexedDB.open(`${docId}:${name}`))
    const out = idbStoresFromDb(db)
    db.close()
    return out
}

export function handleGetDatabaseStores(port: MessagePort, docId: string) {
    handleRequests<GetDatabaseStoresMethod>(
        port,
        "getDatabaseStores",
        getDatabaseStoresHandler.bind(undefined, docId),
    )
}

function idbStoresFromDb(db: IDBDatabase) {
    const names = db.objectStoreNames
    if (names.length === 0) {
        return []
    }
    const tx = db.transaction(names, "readonly")
    const out: GetDatabaseStoresMethod["res"]["result"] = []

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
