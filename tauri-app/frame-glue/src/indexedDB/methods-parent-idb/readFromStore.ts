import { handleRequests, type Notification } from "../../rpcOverPorts"
import { cmp } from "../inMemoryIdb/lib/cmp"
import type { Handlers } from "../methods-scaffolding/setupIDBMethodHandlers"
import type {
    GetAllKeys,
    ExecuteReadMethod,
    ReadMethods,
} from "../methods-scaffolding/types/"
import { openedDbs } from "./OpenDatabase"
import { deserializeQuery, type SerializedQuery } from "./SerializedRange"

type GetAll = Notification<
    "getAll",
    {
        query?: SerializedQuery
        count?: number
    }
>

type GetAllKeysFromIndex = Notification<
    "getAllKeysFromIndex",
    {
        indexName: string
        query?: SerializedQuery
        count?: number
    }
>

type GetAllFromIndex = Notification<
    "getAllFromIndex",
    {
        indexName: string
        query?: SerializedQuery
        count?: number
    }
>

export function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
    return new Promise((res, rej) => {
        const onSuccess = (e: Event) => {
            res((e.target as IDBRequest<T>).result)
            request.removeEventListener("success", onSuccess)
        }
        request.addEventListener("success", onSuccess)
        const onError = (e: Event) => {
            rej((e.target as IDBRequest<T>).error)
            request.removeEventListener("error", onError)
        }
        request.addEventListener("error", onError)
    })
}

export const executeReadHandler: Handlers["executeRead"] = async (
    docId,
    req,
): Promise<
    | IDBValidKey[]
    | [unknown[], IDBValidKey[]]
    | { key: IDBValidKey; value: unknown; primaryKey: IDBValidKey }
    | undefined
> => {
    const { call, dbName, store } = req

    let dbRecord: IDBDatabase | undefined = undefined
    let dbs: IDBDatabaseInfo[] | undefined = undefined
    let openedNewConn = false
    if (openedDbs[`${docId}:${dbName}`]) {
        dbRecord = openedDbs[`${docId}:${dbName}`].db
    } else {
        dbs = await indexedDB.databases()
    }
    if (dbs !== undefined && dbs.some((v) => v.name === `${docId}:${dbName}`)) {
        dbRecord = await new Promise((res) => {
            const request = indexedDB.open(`${docId}:${dbName}`)
            request.onsuccess = () => res(request.result)
        })
        openedNewConn = true
    }
    let tx: IDBTransaction | undefined = undefined
    try {
        if (dbRecord !== undefined) tx = dbRecord.transaction(store, "readonly")
    } catch (e) {
        dbRecord = undefined
        console.error("Unexpected error", e, req)
        /* empty */
    }
    if (dbRecord === undefined || tx === undefined) {
        // db is not created; return nothing for all requests
        // simulate version 0 of a db
        switch (call.method) {
            case "getAllKeys":
                return []
            case "getAllRecords":
                return [[], []]
            case "getAllRecordsFromIndex":
                return [[], []]
            case "getNextFromCursor":
                return undefined
        }
    }
    tx!.onabort = () => {
        if (openedNewConn) {
            dbRecord!.close()
        }
    }
    tx!.onerror = () => {
        if (openedNewConn) {
            dbRecord!.close()
        }
    }
    tx!.oncomplete = () => {
        if (openedNewConn) {
            dbRecord!.close()
        }
    }

    const objStore = tx!.objectStore(store)
    if (call.method === "getNextFromCursor") {
        const {
            range: serializedRange,
            direction,
            indexName,
            currPrimaryKey,
            prevPrimaryKey,
            justKeys,
        } = call.params
        const range = (
            serializedRange ? deserializeQuery(serializedRange) : undefined
        ) as IDBKeyRange

        const parentObject = indexName ? objStore.index(indexName) : objStore
        const cursorRequest: IDBRequest<IDBCursor | null> = justKeys
            ? parentObject.openKeyCursor(range, direction)
            : (parentObject.openCursor(
                  range,
                  direction,
              ) as IDBRequest<IDBCursor | null>)

        let cursor = await requestToPromise(cursorRequest)
        if (cursor === null) {
            return undefined
        }
        if (
            currPrimaryKey !== undefined &&
            cmp(cursor.primaryKey, currPrimaryKey) >= 0
        ) {
            /* empty */
        } else if (currPrimaryKey !== undefined) {
            cursor.continuePrimaryKey(
                direction.includes("next") ? range.lower : range.upper,
                currPrimaryKey,
            )
            cursor = await requestToPromise(cursorRequest)
        } else if (cursor.primaryKey === prevPrimaryKey) {
            cursor.advance(1)
            cursor = await requestToPromise(cursorRequest)
        } else if (prevPrimaryKey !== undefined) {
            cursor.continuePrimaryKey(
                direction.includes("next") ? range.lower : range.upper,
                prevPrimaryKey,
            )
            cursor = await requestToPromise(cursorRequest)
            cursor?.advance(1)
            cursor = await requestToPromise(cursorRequest)
        }

        if (cursor === null) {
            return undefined
        }

        return {
            key: cursor.key,
            value: "value" in cursor ? cursor.value : undefined,
            primaryKey: cursor.primaryKey,
        }
    } else if (call.method === "getAllRecords") {
        const req1 = requestToPromise(
            methodToRequest(
                {
                    method: "getAll",
                    params: call.params,
                },
                objStore,
            ) as IDBRequest<unknown[]>,
        )
        const req2 = requestToPromise(
            methodToRequest(
                { method: "getAllKeys", params: call.params },
                objStore,
            ) as IDBRequest<IDBValidKey[]>,
        )
        return Promise.all([req1, req2] as const)
    } else if (call.method === "getAllRecordsFromIndex") {
        const req1 = methodToRequest(
            {
                method: "getAllFromIndex",
                params: call.params,
            },
            objStore,
        ) as IDBRequest<unknown[]>
        const req2 = methodToRequest(
            { method: "getAllKeysFromIndex", params: call.params },
            objStore,
        ) as IDBRequest<IDBValidKey[]>
        return Promise.all([
            requestToPromise(req1),
            requestToPromise(req2),
        ] as const)
    } else {
        const request = methodToRequest(call, objStore)
        return requestToPromise(request) as Promise<IDBValidKey[]>
    }
}
export function handleReadMethod(port: MessagePort, docId: string) {
    handleRequests<ExecuteReadMethod<ReadMethods>>(
        port,
        "executeRead",
        executeReadHandler.bind(undefined, docId),
    )
}
function methodToRequest<
    C extends
        | { req: GetAll; res: unknown[] }
        | { req: GetAllKeys; res: IDBValidKey[] }
        | { req: GetAllKeysFromIndex; res: IDBValidKey[] }
        | { req: GetAllFromIndex; res: unknown[] },
    M extends C["req"],
>(call: M, objStore: IDBObjectStore): IDBRequest<C["res"]> {
    switch (call.method) {
        case "getAll": {
            const { query, count } = call.params
            return objStore.getAll(
                query !== undefined ? deserializeQuery(query) : query,
                count,
            ) as IDBRequest<C["res"]>
        }
        case "getAllKeys": {
            const { query, count } = call.params
            return objStore.getAllKeys(
                query ? deserializeQuery(query) : null,
                count,
            ) as IDBRequest<C["res"]>
        }
        case "getAllKeysFromIndex": {
            const { indexName, query, count } = call.params
            const index = objStore.index(indexName)
            return index.getAllKeys(
                query ? deserializeQuery(query) : null,
                count,
            ) as IDBRequest<C["res"]>
        }
        case "getAllFromIndex": {
            const { indexName, query, count } = call.params
            const index = objStore.index(indexName)
            return index.getAll(query ? deserializeQuery(query) : null, count)
        }
    }
}
