import { handleRequests } from "../../rpcOverPorts"
import type { Handlers } from "../methods-scaffolding/setupIDBMethodHandlers"
import type { ExecuteTransactionMethod } from "../methods-scaffolding/types/"
import { openedDbs } from "./OpenDatabase"
import { performWriteOperation } from "./performWriteOperation"

export const executeTransactionHandler: Handlers["executeTransaction"] = async (
    docId,
    req,
) => {
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
}

export function handleExecuteIDBTransactionMethod(
    port: MessagePort,
    docId: string,
) {
    handleRequests<ExecuteTransactionMethod>(
        port,
        "executeTransaction",
        executeTransactionHandler.bind(undefined, docId),
    )
}
