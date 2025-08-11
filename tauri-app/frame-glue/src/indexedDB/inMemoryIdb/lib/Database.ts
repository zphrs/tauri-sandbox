import FDBDatabase from "../FDBDatabase.js"
import FDBTransaction from "../FDBTransaction.js"
import ObjectStore from "./ObjectStore.js"
import { queueTask } from "./scheduling.js"

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
