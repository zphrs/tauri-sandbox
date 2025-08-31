import { call } from "../../rpcOverPorts"
import type {
    ExecuteTransactionMethod,
    Write,
    WriteLog,
    UpgradeActions,
} from "../methods-scaffolding/types/"
import type FDBCursor from "./FDBCursor"
import FDBDatabase from "./FDBDatabase"
import { callOpenDatabase } from "./FDBFactory"
import type FDBIndex from "./FDBIndex"
import FDBObjectStore from "./FDBObjectStore"
import FDBRequest from "./FDBRequest"
import {
    AbortError,
    InvalidStateError,
    NotFoundError,
    TransactionInactiveError,
} from "./lib/errors"
import FakeDOMStringList from "./lib/FakeDOMStringList"
import FakeEvent from "./lib/FakeEvent"
import FakeEventTarget from "./lib/FakeEventTarget"
import { queueTask } from "./lib/scheduling"
import type {
    EventCallback,
    RequestObj,
    RollbackLog,
    TransactionMode,
} from "./lib/types"

// http://www.w3.org/TR/2015/REC-IndexedDB-20150108/#transaction
class FDBTransaction extends FakeEventTarget {
    public _state:
        | "active"
        | "inactive"
        | "committing"
        | "finished"
        | "aborting" = "active"
    public _started = false
    public _rollbackLog: RollbackLog = []
    public _writeActions: WriteLog | undefined
    public _upgradeActions: UpgradeActions[] = []
    public _objectStoresCache: Map<string, FDBObjectStore> = new Map()

    public objectStoreNames: FakeDOMStringList
    public mode: TransactionMode
    public db: FDBDatabase
    public error: Error | null = null
    public onabort: EventCallback | null = null
    public oncomplete: EventCallback | null = null
    public onerror: EventCallback | null = null

    public _scope: Set<string>
    private _requests: {
        operation: () => unknown | Promise<unknown>
        request: FDBRequest
    }[] = []

    constructor(storeNames: string[], mode: TransactionMode, db: FDBDatabase) {
        super()

        this._scope = new Set(storeNames)
        this.mode = mode
        this.db = db
        this._writeActions = {
            dbName: db.name,
            ops: storeNames.reduce(
                (prev: { [key: string]: Write[] }, curr: string) => {
                    prev[curr] = []
                    return prev
                },
                {} as { [key: string]: Write[] },
            ),
        }
        this.objectStoreNames = new FakeDOMStringList(
            ...Array.from(this._scope).sort(),
        )
    }

    // http://www.w3.org/TR/2015/REC-IndexedDB-20150108/#dfn-steps-for-aborting-a-transaction
    public _abort(errName: string | null) {
        for (const f of this._rollbackLog.reverse()) {
            f()
        }
        if (errName === "AbortError") {
            this.error = new AbortError()
        } else if (errName !== null) {
            const e = new DOMException(undefined, errName)
            this.error = e
        }

        // Should this directly remove from _requests?
        for (const { request } of this._requests) {
            if (request.readyState !== "done") {
                request.readyState = "done" // This will cancel execution of this request's operation
                if (request.source) {
                    request.result = undefined
                    request.error = new AbortError()

                    const event = new FakeEvent("error", {
                        bubbles: true,
                        cancelable: true,
                    })
                    event.eventPath = [this.db, this]
                    request.dispatchEvent(event)
                }
            }
        }

        this._upgradeActions = []

        this._writeActions = undefined

        queueTask(() => {
            this._state = "aborting"
            const event = new FakeEvent("abort", {
                bubbles: true,
                cancelable: false,
            })
            event.eventPath = [this.db]
            this.dispatchEvent(event)
            this._state = "finished"
        })

        this._state = "finished"
    }

    public abort() {
        if (this._state === "committing" || this._state === "finished") {
            throw new InvalidStateError()
        }
        this._state = "active"

        this._abort(null)
    }

    // http://w3c.github.io/IndexedDB/#dom-idbtransaction-objectstore
    public objectStore(name: string, _justCreated: boolean = false) {
        if (this._state !== "active") {
            throw new InvalidStateError()
        }

        const objectStore = this._objectStoresCache.get(name)
        if (objectStore !== undefined) {
            return objectStore
        }

        const rawObjectStore = this.db._rawDatabase.rawObjectStores.get(name)
        if (!this._scope.has(name) || rawObjectStore === undefined) {
            throw new NotFoundError()
        }

        let writeActionArr: Write[] | undefined = undefined

        if (this.mode === "versionchange") {
            const found = this._upgradeActions.findLast(
                (v) =>
                    (v.method === "createObjectStore" ||
                        v.method === "modifyObjectStore") &&
                    v.params.name === name,
            )
            if (found) {
                writeActionArr = (found.params as { doOnUpgrade: Write[] })
                    .doOnUpgrade
            } else {
                writeActionArr = []
                this._upgradeActions.push({
                    method: "modifyObjectStore",
                    params: {
                        name,
                        doOnUpgrade: writeActionArr,
                    },
                })
            }
        }
        if (writeActionArr === undefined) {
            writeActionArr = this._writeActions!.ops[name]
        }

        const objectStore2 = new FDBObjectStore(
            this,
            rawObjectStore,
            writeActionArr,
            _justCreated,
        )
        this._objectStoresCache.set(name, objectStore2)

        return objectStore2
    }

    // http://www.w3.org/TR/2015/REC-IndexedDB-20150108/#dfn-steps-for-asynchronously-executing-a-request
    public _execRequestAsync(obj: RequestObj) {
        const source = obj.source
        const operation = obj.operation
        let request = Object.hasOwn(obj, "request") ? obj.request : null

        if (this._state !== "active") {
            throw new TransactionInactiveError()
        }

        // Request should only be passed for cursors
        if (!request) {
            if (!source) {
                // Special requests like indexes that just need to run some code
                request = new FDBRequest()
            } else {
                request = new FDBRequest()
                request.source = source as
                    | FDBObjectStore
                    | FDBCursor
                    | FDBIndex
                    | null
                request.transaction =
                    "transaction" in source ? source.transaction : null
            }
        }

        this._requests.push({
            operation,
            request,
        })

        return request
    }

    public async _start() {
        this._started = true

        // Remove from request queue - cursor ones will be added back if necessary by cursor.continue and such
        let operation
        let request
        while (this._requests.length > 0) {
            const r = this._requests.shift()

            // This should only be false if transaction was aborted
            if (r && r.request.readyState !== "done") {
                request = r.request
                operation = r.operation
                break
            }
        }

        if (request && operation) {
            if (!request.source) {
                // Special requests like indexes that just need to run some code, with error handling already built into
                // operation
                await operation()
            } else {
                let defaultAction
                let event
                try {
                    const result = await operation()
                    request.readyState = "done"
                    request.result = result
                    request.error = undefined

                    // http://www.w3.org/TR/2015/REC-IndexedDB-20150108/#dfn-fire-a-success-event
                    if (this._state === "inactive") {
                        this._state = "active"
                    }
                    event = new FakeEvent("success", {
                        bubbles: false,
                        cancelable: false,
                    })
                } catch (e: unknown) {
                    const err = e as DOMException
                    request.readyState = "done"
                    request.result = undefined
                    request.error = err
                    // http://www.w3.org/TR/2015/REC-IndexedDB-20150108/#dfn-fire-an-error-event
                    if (this._state === "inactive") {
                        this._state = "active"
                    }
                    event = new FakeEvent("error", {
                        bubbles: true,
                        cancelable: true,
                    })

                    defaultAction = this._abort.bind(this, err.name)
                }
                const timeoutForInactive = new Promise((res) =>
                    setTimeout(res, 0),
                )
                try {
                    event.eventPath = [this.db, this]
                    request.dispatchEvent(event)
                    await timeoutForInactive
                } catch (err) {
                    await timeoutForInactive
                    if (this._state !== "committing") {
                        this._abort("AbortError")
                    } else {
                        this._state = "inactive"
                        queueTask(this._start.bind(this))
                        throw err
                    }
                }

                // Default action of event
                if (!event.canceled) {
                    if (defaultAction) {
                        defaultAction()
                    }
                }
            }

            this._state = "inactive"
            // Give it another chance for new handlers to be set before finishing
            queueTask(this._start.bind(this))
            return
        }

        // Check if transaction complete event needs to be fired
        if (this._state === "aborting") {
            this._state = "finished"
        }
        if (this._state !== "finished") {
            // clear all modifications for the next transaction
            for (const objectStore of this._objectStoresCache.values()) {
                objectStore._rawObjectStore.cleanupAfterCompletedTransaction()
            }
            // Either aborted or committed already
            this._state = "finished"
            if (!this.error) {
                if (this.mode === "versionchange") {
                    await callOpenDatabase(this.db, this._upgradeActions)
                } else if (
                    this._writeActions &&
                    Object.values(this._writeActions.ops).some(
                        (v) => v.length !== 0,
                    )
                ) {
                    await call<ExecuteTransactionMethod>(
                        this.db._rawDatabase._port,
                        "executeTransaction",
                        this._writeActions,
                    )
                }
                const event = new FakeEvent("complete")
                this.dispatchEvent(event)
            }
        }
    }

    public commit() {
        if (this._state !== "active") {
            throw new TransactionInactiveError()
        }

        this._state = "committing"
    }

    public toString() {
        return "[object IDBRequest]"
    }
}

export default FDBTransaction
