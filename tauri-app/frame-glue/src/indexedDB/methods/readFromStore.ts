import {
    handleRequests,
    type Method,
    type Notification,
} from "../../rpcOverPorts"
import { openedDbs } from "./OpenIDBDatabase"
import { deserializeQuery, type SerializedQuery } from "./SerializedRange"

export type Get = Notification<
    "get",
    {
        query: SerializedQuery
    }
>

export type GetAll = Notification<
    "getAll",
    {
        query?: SerializedQuery
        count?: number
    }
>

export type GetKey = Notification<
    "getKey",
    {
        query: SerializedQuery
    }
>

export type GetAllKeys = Notification<
    "getAllKeys",
    {
        query?: SerializedQuery
        count?: number
    }
>

export type Count = Notification<
    "count",
    {
        query?: SerializedQuery
    }
>

export type GetAllRecords = Notification<
    "getAllRecords",
    {
        query?: SerializedQuery
        count?: number
    }
>

export type GetAllRecordsFromIndex = Notification<
    "getAllRecordsFromIndex",
    {
        indexName: string
        query?: SerializedQuery
        count?: number
    }
>

export type GetAllKeysFromIndex = Notification<
    "getAllKeysFromIndex",
    {
        indexName: string
        query?: SerializedQuery
        count?: number
    }
>

export type GetAllFromIndex = Notification<
    "getAllFromIndex",
    {
        indexName: string
        query?: SerializedQuery
        count?: number
    }
>

export type GetWithKey = Notification<
    "getWithKey",
    {
        query: SerializedQuery
    }
>

export type Read =
    | Get
    | GetAll
    | GetKey
    | GetAllKeys
    | Count
    | GetAllRecords
    | GetWithKey
    | GetAllKeysFromIndex
    | GetAllFromIndex
    | GetAllRecordsFromIndex

export type GetMethod = ExecuteReadMethod<Get, unknown>
export type GetAllMethod = ExecuteReadMethod<GetAll, unknown[]>
export type GetKeyMethod = ExecuteReadMethod<GetKey, IDBValidKey | undefined>
export type GetAllKeysMethod = ExecuteReadMethod<GetAllKeys, IDBValidKey[]>
export type CountMethod = ExecuteReadMethod<Count, number>
export type GetAllRecordsMethod = ExecuteReadMethod<
    GetAllRecords,
    [GetAllMethod["res"]["result"], GetAllKeysMethod["res"]["result"]]
>
export type GetAllKeysFromIndexMethod = ExecuteReadMethod<
    GetAllKeysFromIndex,
    IDBValidKey[]
>
export type GetAllFromIndexMethod = ExecuteReadMethod<
    GetAllFromIndex,
    unknown[]
>
export type GetAllRecordsFromIndexMethod = ExecuteReadMethod<
    GetAllRecordsFromIndex,
    [
        GetAllFromIndexMethod["res"]["result"],
        GetAllKeysFromIndexMethod["res"]["result"]
    ]
>

export type GetWithKeyMethod = ExecuteReadMethod<
    GetWithKey,
    [GetMethod["res"]["result"], GetKeyMethod["res"]["result"]]
>

export type ExecuteReadMethod<R extends Read, Return> = Method<
    "executeReadMethod",
    { call: R; dbName: string; store: string },
    Return
>

export function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
    return new Promise((res) => {
        request.onsuccess = (e) => res((e.target as IDBRequest<T>).result)
    })
}

export function handleReadMethod(port: MessagePort, docId: string) {
    handleRequests<ExecuteReadMethod<Read, unknown>>(
        port,
        "executeReadMethod",
        async (req) => {
            const { call, dbName, store } = req
            console.log(call, dbName, store)
            let db: IDBDatabase | undefined = openedDbs[`${docId}:${dbName}`]
            if (db === undefined) {
                const dbs = await indexedDB.databases()
                if (dbs.some((v) => v.name === `${docId}:${dbName}`)) {
                    db = openedDbs[`${docId}:${dbName}`] = await new Promise(
                        (res) => {
                            const request = indexedDB.open(`${docId}:${dbName}`)
                            request.onsuccess = () => res(request.result)
                        }
                    )
                } else {
                    // db is not created; return nothing for all requests
                    // simulate version 0 of a db
                    switch (call.method) {
                        case "get":
                            return undefined
                        case "getAll":
                            return []
                        case "getKey":
                            return undefined
                        case "getAllKeys":
                            return []
                        case "count":
                            return 0
                        case "getAllRecords":
                            return [[], []]
                        case "getWithKey":
                            return [undefined, undefined]
                    }
                }
            }
            const tx = db.transaction(store, "readonly")

            const objStore = tx.objectStore(store)
            if (call.method === "getAllRecords") {
                const req1 = methodToRequest(
                    {
                        method: "getAll",
                        params: call.params,
                    },
                    objStore
                )
                const req2 = methodToRequest(
                    { method: "getAllKeys", params: call.params },
                    objStore
                )
                return Promise.all([req1, req2].map(requestToPromise))
            } else if (call.method === "getWithKey") {
                const req1 = methodToRequest(
                    {
                        method: "get",
                        params: call.params,
                    },
                    objStore
                )
                const req2 = methodToRequest(
                    { method: "getKey", params: call.params },
                    objStore
                )
                return Promise.all([req1, req2].map(requestToPromise))
            } else if (call.method === "getAllRecordsFromIndex") {
                const req1 = methodToRequest(
                    {
                        method: "getAllFromIndex",
                        params: call.params,
                    },
                    objStore
                )
                const req2 = methodToRequest(
                    { method: "getAllKeysFromIndex", params: call.params },
                    objStore
                )
                return Promise.all([req1, req2].map(requestToPromise))
            } else {
                const request = methodToRequest(call, objStore)
                return requestToPromise(request)
            }
        }
    )
}
function methodToRequest(
    call: Exclude<Read, GetAllRecords | GetWithKey | GetAllRecordsFromIndex>,
    objStore: IDBObjectStore
) {
    switch (call.method) {
        case "get": {
            const { query } = call.params
            return objStore.get(deserializeQuery(query)!)
        }
        case "getAll": {
            const { query, count } = call.params
            return objStore.getAll(
                query !== undefined ? deserializeQuery(query) : query,
                count
            )
        }
        case "getKey": {
            const { query } = call.params
            return objStore.getKey(deserializeQuery(query)!)
        }
        case "getAllKeys": {
            const { query, count } = call.params
            return objStore.getAllKeys(
                query ? deserializeQuery(query) : null,
                count
            )
        }
        case "count": {
            const { query } = call.params
            return objStore.count(
                query === undefined ? undefined : deserializeQuery(query)
            )
        }
        case "getAllKeysFromIndex": {
            const { indexName, query, count } = call.params
            const index = objStore.index(indexName)
            return index.getAllKeys(
                query ? deserializeQuery(query) : null,
                count
            )
        }
        case "getAllFromIndex": {
            const { indexName, query, count } = call.params
            const index = objStore.index(indexName)
            return index.getAll(query ? deserializeQuery(query) : null, count)
        }
    }
}
