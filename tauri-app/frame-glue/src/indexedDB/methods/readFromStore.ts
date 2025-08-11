import {
    handleRequests,
    type Method,
    type Notification,
} from "../../rpcOverPorts"
import { openedDbs } from "./OpenIDBDatabase"
import { deserializeQuery, type SerializedQuery } from "./SerializedRange"

export type Read =
    | Notification<"get", { query: SerializedQuery }>
    | Notification<"getAll", { query: SerializedQuery; count: number }>
    | Notification<"getKey", { query: SerializedQuery }>
    | Notification<"getAllKeys", { query: SerializedQuery; count: number }>
    | Notification<"count", { query?: SerializedQuery }>

export type ExecuteReadMethod = Method<
    "executeReadMethod",
    { call: Read; dbName: string; store: string },
    any
>

export function handleReadMethod(port: MessagePort, docId: string) {
    handleRequests<ExecuteReadMethod>(
        port,
        "executeReadMethod",
        async (req) => {
            const { call, dbName, store } = req
            const db = openedDbs[`${docId}:${dbName}`]
            const tx = db.transaction(dbName, "readonly")
            const objStore = tx.objectStore(store)
            const request = methodToRequest(call, objStore)
            return new Promise((res) => {
                request.onsuccess = (e) => {
                    res((e.target as IDBRequest<any>).result)
                }
            })
        }
    )
}
function methodToRequest(call: Read, objStore: IDBObjectStore) {
    switch (call.method) {
        case "get": {
            const { query } = call.params
            return objStore.get(deserializeQuery(query))
        }
        case "getAll": {
            const { query, count } = call.params
            return objStore.getAll(deserializeQuery(query), count)
        }
        case "getKey": {
            const { query } = call.params
            return objStore.getKey(deserializeQuery(query))
        }
        case "getAllKeys": {
            const { query, count } = call.params
            return objStore.getAllKeys(deserializeQuery(query), count)
        }
        case "count": {
            const { query } = call.params
            return objStore.count(
                query === undefined ? undefined : deserializeQuery(query)
            )
        }
    }
}
