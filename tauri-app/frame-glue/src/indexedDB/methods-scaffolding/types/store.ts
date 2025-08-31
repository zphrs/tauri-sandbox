import { type Method } from "../../../rpcOverPorts"
import type { KeyPath } from "../../inMemoryIdb/lib/types"

// Types from GetIDBDatabaseStores.ts
export type SerializedIndex = {
    name: string
    keyPath: KeyPath
    multiEntry: boolean
    unique: boolean
}

export type Store = {
    name: string
    parameters: IDBObjectStoreParameters
    indexes: SerializedIndex[]
}

export type GetDatabaseStoresMethod = Method<
    "getDatabaseStores",
    { name: string },
    Store[]
>
