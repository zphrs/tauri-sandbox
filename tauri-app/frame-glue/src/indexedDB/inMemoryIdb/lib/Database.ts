import { call } from "../../../rpcOverPorts"
import type { GetIDBDatabaseStoresMethod } from "../../methods/GetIDBDatabaseStores"
import FDBDatabase from "../FDBDatabase"
import FDBTransaction from "../FDBTransaction"
import ObjectStore from "./ObjectStore"
import { queueTask } from "./scheduling"

// http://www.w3.org/TR/2015/REC-IndexedDB-20150108/#dfn-database
class Database {
    public deletePending = false
    public readonly transactions: FDBTransaction[] = []
    public readonly rawObjectStores: Map<string, ObjectStore> = new Map()
    public connections: FDBDatabase[] = []

    public readonly name: string
    public version: number
    public readonly _port: MessagePort

    constructor(name: string, version: number, port: MessagePort) {
        this.name = name
        this.version = version
        this._port = port

        this.processTransactions = this.processTransactions.bind(this)
    }

    public async sync() {
        this.rawObjectStores.clear()
        for (const objectStore of (
            await call<GetIDBDatabaseStoresMethod>(
                this._port,
                "getIDBDBStores",
                {
                    name: this.name,
                },
            )
        ).map(({ name, parameters }) => {
            const os = new ObjectStore(
                this,
                name,
                parameters.keyPath ?? null,
                !!parameters.autoIncrement,
            )
            return os
        })) {
            this.rawObjectStores.set(objectStore.name, objectStore)
        }
    }

    public processTransactions() {
        queueTask(() => {
            const anyRunning = this.transactions.some((transaction) => {
                return transaction._started && transaction._state !== "finished"
            })

            if (!anyRunning) {
                const next = this.transactions.find((transaction) => {
                    return (
                        !transaction._started &&
                        transaction._state !== "finished"
                    )
                })

                if (next) {
                    next.addEventListener("complete", this.processTransactions)
                    next.addEventListener("abort", this.processTransactions)
                    next._start()
                }
            }
        })
    }
}

export default Database
