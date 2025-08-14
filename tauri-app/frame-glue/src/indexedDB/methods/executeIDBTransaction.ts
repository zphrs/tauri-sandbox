import {
    handleRequests,
    type Method,
    type Notification,
} from "../../rpcOverPorts"
import { openedDbs } from "./OpenIDBDatabase"
import { type SerializedQuery, deserializeQuery } from "./SerializedRange"

type Add = Notification<
    "add",
    {
        value: unknown
        key?: IDBValidKey
    }
>

type Clear = Notification<"clear", undefined>

type Delete = Notification<
    "delete",
    {
        query: SerializedQuery
    }
>

type Put = Notification<
    "put",
    {
        value: unknown
        key?: IDBValidKey
    }
>

type Replace = Notification<
    "replace",
    {
        key: string
        index: string
        value: string
    }
>

export type WriteMethods = {
    add: Add
    clear: Clear
    delete: Delete
    put: Put
    replace: Replace
}
export type Write = Add | Clear | Delete | Put | Replace

export type WriteLog = {
    dbName: string
    ops: {
        [objectStoreName: string]: Write[]
    }
}

export type ExecuteIDBTransactionMethod = Method<
    "executeIDBTransactionMethod",
    WriteLog,
    undefined
>

export function handleExecuteIDBTransactionMethod(
    port: MessagePort,
    docId: string
) {
    handleRequests<ExecuteIDBTransactionMethod>(
        port,
        "executeIDBTransactionMethod",
        async (req) => {
            const { dbName, ops: txs } = req
            const db = openedDbs[`${docId}:${dbName}`]

            const tx = db.transaction(Object.keys(txs), "readwrite")
            for (const storeName in txs) {
                const changes = txs[storeName]
                const store: IDBObjectStore = tx.objectStore(
                    `${storeName}:main`
                )

                for (const change of changes) {
                    performWriteOperation(change, store)
                }
                return new Promise((res) => {
                    tx.oncomplete = () => {
                        res(undefined)
                    }
                })
            }
        }
    )
}

export async function performWriteOperation(
    change: Write,
    store: IDBObjectStore
) {
    switch (change.method) {
        case "add": {
            const { value, key } = change.params
            return store.add(value, key)
        }
        case "clear": {
            return store.clear()
        }
        case "delete": {
            const { query } = change.params
            return store.delete(deserializeQuery(query))
        }
        case "put": {
            const { value, key } = change.params
            return store.put(value, key)
        }
        case "replace": {
            // key stays the same so no need to update the metadata store
            const { key, index, value } = change.params
            const request = store.index(index).openCursor(key)
            return new Promise<IDBRequest<IDBValidKey>>((res) => {
                request.onsuccess = () => {
                    res(request.result!.update(value))
                }
            })
        }
    }
}
