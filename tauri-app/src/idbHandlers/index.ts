import { KeyPath } from "frame-glue/lib/src/indexedDB/inMemoryIdb/lib/types"
import { Handlers } from "frame-glue/lib/src/indexedDB/methods-scaffolding/setupIDBMethodHandlers"
import { GetAllKeys, GetAllRecords, GetAllRecordsFromIndex, GetNextFromCursor } from "frame-glue/lib/src/indexedDB/methods-scaffolding/types/read"
import { Store } from "frame-glue/lib/src/indexedDB/methods-scaffolding/types/store"
import { WriteLog } from "frame-glue/lib/src/indexedDB/methods-scaffolding/types/transaction"
import { UpgradeActions } from "frame-glue/lib/src/indexedDB/methods-scaffolding/types/upgrade"

export const indexedDBHandlers: Handlers = {
    openDatabase: function (this: undefined, docId: string, req: { name: string; version?: number; doOnUpgrade: UpgradeActions[] }): Promise<{ objectStores: { name: string; parameters: IDBObjectStoreParameters; indexes: { name: string; parameters: IDBIndexParameters; keyPath: KeyPath }[] }[] } | { result: { objectStores: { name: string; parameters: IDBObjectStoreParameters; indexes: { name: string; parameters: IDBIndexParameters; keyPath: KeyPath }[] }[] }; transferableObjects: Transferable[] }> {
        throw new Error("Function not implemented.")
    },
    closeDatabase: function (this: undefined, docId: string, req: { name: string }): Promise<{ result: null; transferableObjects: Transferable[] } | null> {
        throw new Error("Function not implemented.")
    },
    deleteDatabase: function (this: undefined, docId: string, req: { name: string }): Promise<{ result: null; transferableObjects: Transferable[] } | null> {
        throw new Error("Function not implemented.")
    },
    getDbInfo: function (this: undefined, docId: string, req: undefined): Promise<IDBDatabaseInfo[] | { result: IDBDatabaseInfo[]; transferableObjects: Transferable[] }> {
        throw new Error("Function not implemented.")
    },
    getDatabaseStores: function (this: undefined, docId: string, req: { name: string }): Promise<Store[] | { result: Store[]; transferableObjects: Transferable[] }> {
        throw new Error("Function not implemented.")
    },
    executeRead: function (this: undefined, docId: string, req: { call: GetAllKeys; dbName: string; store: string } | { call: GetAllRecords; dbName: string; store: string } | { call: GetAllRecordsFromIndex; dbName: string; store: string } | { call: GetNextFromCursor; dbName: string; store: string }): Promise<IDBValidKey[] | [unknown[], IDBValidKey[]] | [unknown[], IDBValidKey[]] | { key: IDBValidKey; value: unknown; primaryKey: IDBValidKey } | { result: IDBValidKey[] | [unknown[], IDBValidKey[]] | [unknown[], IDBValidKey[]] | { key: IDBValidKey; value: unknown; primaryKey: IDBValidKey } | undefined; transferableObjects: Transferable[] } | undefined> {
        throw new Error("Function not implemented.")
    },
    executeTransaction: function (this: undefined, docId: string, req: WriteLog): Promise<{ result: undefined; transferableObjects: Transferable[] } | undefined> {
        throw new Error("Function not implemented.")
    }
}
