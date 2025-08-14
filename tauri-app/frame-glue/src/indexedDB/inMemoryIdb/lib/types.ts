import type {
    FDBCursor,
    FDBIndex,
    FDBKeyRange,
    FDBObjectStore,
    FDBRequest,
} from "../"

export type CursorSource = FDBIndex | FDBObjectStore

interface EventInCallback extends Event {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    target: any
    error: Error | null
}

export type EventCallback = (event: EventInCallback) => void

export type EventType =
    | "abort"
    | "blocked"
    | "complete"
    | "error"
    | "success"
    | "upgradeneeded"
    | "versionchange"

export type FDBCursorDirection = "next" | "nextunique" | "prev" | "prevunique"

export type KeyPath = string | string[]

export type Key = IDBValidKey

export type CursorRange = FDBKeyRange | undefined

export type Value = unknown

export interface Record {
    key: Key
    value: Key | Value // For indexes, will be Key. For object stores, will be Value.
}

export interface RequestObj {
    operation: () => unknown | Promise<unknown>
    request?: FDBRequest | undefined
    source?: FDBObjectStore | FDBCursor | FDBIndex | null
}

export type RollbackLog = (() => void)[]

export type TransactionMode = "readonly" | "readwrite" | "versionchange"
