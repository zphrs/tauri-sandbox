import { call } from "../../rpcOverPorts.js"
import FDBDatabase from "./FDBDatabase.js"
import FDBOpenDBRequest from "./FDBOpenDBRequest.js"
import FDBVersionChangeEvent from "./FDBVersionChangeEvent.js"
import cmp from "./lib/cmp.js"
import Database from "./lib/Database.js"
import enforceRange from "./lib/enforceRange.js"
import { AbortError, VersionError } from "./lib/errors.js"
import FakeEvent from "./lib/FakeEvent.js"
import { queueTask } from "./lib/scheduling.js"
import type { GetDbInfoMethod } from "../methods/GetDbInfo.js"
import type { OpenIDBDatabaseMethod } from "../methods/OpenIDBDatabase"

const waitForOthersClosedDelete = (
    databases: Map<string, Database>,
    name: string,
    openDatabases: FDBDatabase[],
    cb: (err: Error | null) => void
) => {
    const anyOpen = openDatabases.some((openDatabase2) => {
        return !openDatabase2._closed && !openDatabase2._closePending
    })

    if (anyOpen) {
        queueTask(() =>
            waitForOthersClosedDelete(databases, name, openDatabases, cb)
        )
        return
    }

    databases.delete(name)

    cb(null)
}

// http://www.w3.org/TR/2015/REC-IndexedDB-20150108/#dfn-steps-for-deleting-a-database
const deleteDatabase = (
    databases: Map<string, Database>,
    name: string,
    request: FDBOpenDBRequest,
    cb: (err: Error | null) => void
) => {
    try {
        const db = databases.get(name)
        if (db === undefined) {
            cb(null)
            return
        }

        db.deletePending = true

        const openDatabases = db.connections.filter((connection) => {
            return !connection._closed && !connection._closePending
        })

        for (const openDatabase2 of openDatabases) {
            if (!openDatabase2._closePending) {
                const event = new FDBVersionChangeEvent("versionchange", {
                    newVersion: null,
                    oldVersion: db.version,
                })
                openDatabase2.dispatchEvent(event)
            }
        }

        const anyOpen = openDatabases.some((openDatabase3) => {
            return !openDatabase3._closed && !openDatabase3._closePending
        })

        if (request && anyOpen) {
            const event = new FDBVersionChangeEvent("blocked", {
                newVersion: null,
                oldVersion: db.version,
            })
            request.dispatchEvent(event)
        }

        waitForOthersClosedDelete(databases, name, openDatabases, cb)
    } catch (err) {
        cb(err instanceof Error ? err : new Error(String(err)))
    }
}

// http://www.w3.org/TR/2015/REC-IndexedDB-20150108/#dfn-steps-for-running-a-versionchange-transaction
const runVersionchangeTransaction = (
    connection: FDBDatabase,
    version: number,
    request: FDBOpenDBRequest,
    cb: (err: Error | null) => void
) => {
    connection._runningVersionchangeTransaction = true

    const oldVersion = connection.version

    const openDatabases = connection._rawDatabase.connections.filter(
        (otherDatabase) => {
            return connection !== otherDatabase
        }
    )

    for (const openDatabase2 of openDatabases) {
        if (!openDatabase2._closed && !openDatabase2._closePending) {
            const event = new FDBVersionChangeEvent("versionchange", {
                newVersion: version,
                oldVersion,
            })
            openDatabase2.dispatchEvent(event)
        }
    }

    const anyOpen = openDatabases.some((openDatabase3) => {
        return !openDatabase3._closed && !openDatabase3._closePending
    })

    if (anyOpen) {
        const event = new FDBVersionChangeEvent("blocked", {
            newVersion: version,
            oldVersion,
        })
        request.dispatchEvent(event)
    }

    const waitForOthersClosed = () => {
        const anyOpen2 = openDatabases.some((openDatabase2) => {
            return !openDatabase2._closed && !openDatabase2._closePending
        })

        if (anyOpen2) {
            queueTask(waitForOthersClosed)
            return
        }

        // Set the version of database to version. This change is considered part of the transaction, and so if the
        // transaction is aborted, this change is reverted.
        connection._rawDatabase.version = version
        connection.version = version

        // Get rid of this setImmediate?
        const transaction = connection.transaction(
            Array.from(connection.objectStoreNames),
            "versionchange"
        )
        request.result = connection
        request.readyState = "done"
        request.transaction = transaction

        transaction._rollbackLog.push(() => {
            connection._rawDatabase.version = oldVersion
            connection.version = oldVersion
        })

        const event = new FDBVersionChangeEvent("upgradeneeded", {
            newVersion: version,
            oldVersion,
        })
        request.dispatchEvent(event)

        transaction.addEventListener("error", () => {
            connection._runningVersionchangeTransaction = false
            // throw arguments[0].target.error;
            // console.log("error in versionchange transaction - not sure if anything needs to be done here", e.target.error.name);
        })
        transaction.addEventListener("abort", () => {
            connection._runningVersionchangeTransaction = false
            request.transaction = null
            queueTask(() => {
                cb(new AbortError())
            })
        })
        transaction.addEventListener("complete", () => {
            connection._runningVersionchangeTransaction = false
            request.transaction = null
            // Let other complete event handlers run before continuing
            queueTask(() => {
                call<OpenIDBDatabaseMethod>(
                    connection._rawDatabase._port,
                    "openDatabase",
                    {
                        name: connection.name,
                        version: version,
                        doOnUpgrade: [],
                    }
                )
                if (connection._closePending) {
                    cb(new AbortError())
                } else {
                    cb(null)
                }
            })
        })
    }

    waitForOthersClosed()
}

// http://www.w3.org/TR/2015/REC-IndexedDB-20150108/#dfn-steps-for-opening-a-database
const openDatabase = async (
    databases: Map<string, Database>,
    name: string,
    version: number | undefined,
    request: FDBOpenDBRequest,
    cb: (err: Error | null, connection?: FDBDatabase) => void,
    port: MessagePort
) => {
    const dbInfo = await call<GetDbInfoMethod>(port, "getDbInfo", undefined)
    let oldVersion = dbInfo.find((v) => v.name == name)?.version
    let db: Database
    if (oldVersion === undefined) {
        oldVersion = 0
        db = new Database(name, 0, port)
        databases.set(name, db)
    } else {
        db = databases.get(name) ?? new Database(name, oldVersion, port)
    }

    if (version === undefined) {
        version = db.version !== 0 ? db.version : 1
    }

    if (db.version > version) {
        return cb(new VersionError())
    }

    const connection = new FDBDatabase(db)

    if (db.version < version) {
        runVersionchangeTransaction(connection, version, request, (err) => {
            if (err) {
                // DO THIS HERE: ensure that connection is closed by running the steps for closing a database connection before these
                // steps are aborted.
                return cb(err)
            }

            cb(null, connection)
        })
    } else {
        cb(null, connection)
    }
}

class FDBFactory {
    public _port
    public cmp = cmp
    private _databases: Map<string, Database> = new Map()

    constructor(port: MessagePort) {
        this._port = port
    }

    // http://www.w3.org/TR/2015/REC-IndexedDB-20150108/#widl-IDBFactory-deleteDatabase-IDBOpenDBRequest-DOMString-name
    public deleteDatabase(name: string) {
        const request = new FDBOpenDBRequest()
        request.source = null

        queueTask(() => {
            const db = this._databases.get(name)
            const oldVersion = db !== undefined ? db.version : 0

            deleteDatabase(this._databases, name, request, (err) => {
                if (err) {
                    request.error = new DOMException(err.message, err.name)
                    request.readyState = "done"

                    const event = new FakeEvent("error", {
                        bubbles: true,
                        cancelable: true,
                    })
                    event.eventPath = []
                    request.dispatchEvent(event)

                    return
                }

                request.result = undefined
                request.readyState = "done"

                const event2 = new FDBVersionChangeEvent("success", {
                    newVersion: null,
                    oldVersion,
                })
                request.dispatchEvent(event2)
            })
        })

        return request
    }

    // http://www.w3.org/TR/2015/REC-IndexedDB-20150108/#widl-IDBFactory-open-IDBOpenDBRequest-DOMString-name-unsigned-long-long-version
    public open(name: string, version?: number) {
        if (arguments.length > 1 && version !== undefined) {
            // Based on spec, not sure why "MAX_SAFE_INTEGER" instead of "unsigned long long", but it's needed to pass
            // tests
            version = enforceRange(version, "MAX_SAFE_INTEGER")
        }
        if (version === 0) {
            throw new TypeError("Database version cannot be 0")
        }

        const request = new FDBOpenDBRequest()
        request.source = null

        queueTask(() => {
            openDatabase(
                this._databases,
                name,
                version,
                request,
                (err, connection) => {
                    if (err) {
                        request.result = undefined
                        request.readyState = "done"

                        request.error = new DOMException(err.message, err.name)

                        const event = new FakeEvent("error", {
                            bubbles: true,
                            cancelable: true,
                        })
                        event.eventPath = []
                        request.dispatchEvent(event)

                        return
                    }

                    request.result = connection
                    request.readyState = "done"

                    const event2 = new FakeEvent("success")
                    event2.eventPath = []
                    request.dispatchEvent(event2)
                },
                this._port
            )
        })

        return request
    }

    // https://w3c.github.io/IndexedDB/#dom-idbfactory-databases
    public async databases() {
        return call<GetDbInfoMethod>(this._port, "getDbInfo", undefined)
    }

    public toString() {
        return "[object IDBFactory]"
    }
}

export default FDBFactory
