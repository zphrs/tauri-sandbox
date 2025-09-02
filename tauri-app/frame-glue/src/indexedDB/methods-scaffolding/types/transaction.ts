import { type Method, type Notification } from "../../../rpcOverPorts"
import { type SerializedQuery } from "../SerializedRange"

// Types from executeIDBTransaction.ts
export type Add = Notification<
    "add",
    {
        value: unknown
        key?: IDBValidKey
    }
>

export type Clear = Notification<"clear", undefined>

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

export type ExecuteTransactionMethod = Method<
    "executeTransaction",
    WriteLog,
    undefined
>
