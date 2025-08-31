import { call } from "../../../rpcOverPorts"
import type { GetDatabaseStoresMethod } from "../../methods-scaffolding/types/"
import FDBDatabase from "../FDBDatabase"
import FDBTransaction from "../FDBTransaction"
import Index from "./Index"
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
            await call<GetDatabaseStoresMethod>(
                this._port,
                "getDatabaseStores",
                {
                    name: this.name,
                },
            )
        ).map(({ name, parameters, indexes }) => {
            const os = new ObjectStore(
                this,
                name,
                parameters.keyPath ?? null,
                !!parameters.autoIncrement,
            )

            for (const index of indexes) {
                const newIndex = new Index(
                    os,
                    index.name,
                    index.keyPath,
                    index.multiEntry,
                    index.unique,
                )
                os.rawIndexes.set(index.name, newIndex)
            }

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
