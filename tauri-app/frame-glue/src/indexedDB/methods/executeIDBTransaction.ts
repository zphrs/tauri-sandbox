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
    docId: string,
) {
    handleRequests<ExecuteIDBTransactionMethod>(
        port,
        "executeIDBTransactionMethod",
        async (req) => {
            const { dbName, ops: txs } = req
            const dbRecord = openedDbs[`${docId}:${dbName}`]
            if (dbRecord === undefined) {
                console.error("shouldn't execute txs on not opened databases")
            }
            const db = dbRecord.db
            let tx
            try {
                tx = db.transaction(Object.keys(txs), "readwrite")
            } catch (e) {
                console.error("Unexpected error while execing tx", e)
                return undefined
            }
            const promises = []
            for (const storeName in txs) {
                const changes = txs[storeName]
                const store: IDBObjectStore = tx.objectStore(storeName)
                for (const change of changes) {
                    performWriteOperation(change, store).then((opReq) => {
                        // we know that this is likely what was carried out on the
                        // parent thread in order to handle the error without
                        // aborting the transaction. See the test file,
                        // ../w3c-vitest-tests/idb-explicit-commit.any.test.ts
                        // specifically the test around line 388: "Transactions
                        // that handle all errors properly should behave as
                        // expected when an explicit commit is called in an
                        // onerror handler."
                        // we warn of the error just in case.
                        opReq.onerror = (e) => {
                            console.warn(
                                "error while executing write op: ",
                                change,
                                e,
                                (e.target as IDBRequest)?.error,
                            )
                            e.preventDefault()
                            e.stopPropagation()
                        }
                    })
                }
                if (changes.length > 0) {
                    promises.push(
                        new Promise((res, rej) => {
                            tx.oncomplete = () => {
                                res(undefined)
                            }
                            tx.onerror = (e) => {
                                console.log("ERR ON TX")
                                rej(e)
                                throw e
                                // e.preventDefault()
                                // tx.commit()
                            }
                        }),
                    )
                }
            }
            await Promise.all(promises)
            return undefined
        },
    )
}

export async function performWriteOperation(
    change: Write,
    store: IDBObjectStore,
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
            const out = store.delete(deserializeQuery(query)!)
            return out
        }
        case "put": {
            const { value, key } = change.params
            return store.put(value, key)
        }
        case "replace": {
            // key stays the same so no need to update the metadata store
            const { key, index, value } = change.params
            const request = store.index(index).openCursor(key)
            return await new Promise<IDBRequest<IDBValidKey>>((res) => {
                request.onsuccess = () => {
                    res(request.result!.update(value))
                }
            })
        }
    }
}
