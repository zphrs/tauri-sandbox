import { getMessagePort } from "../SetupCrossthreadedPorts"
import {
    FDBCursor,
    FDBCursorWithValue,
    FDBDatabase,
    FDBFactory,
    FDBIndex,
    FDBKeyRange,
    FDBObjectStore,
    FDBOpenDBRequest,
    FDBRequest,
    FDBTransaction,
    FDBVersionChangeEvent,
} from "./inMemoryIdb"
import { requestToPromise } from "./methods-parent-idb/readFromStore"
export { handlers } from "./methods-parent-idb"
export { setupIndexedDBMethodHandlers as indexedDBParentSetup } from "./methods-scaffolding/"

export {
    FDBCursor as IDBCursor,
    FDBCursorWithValue as IDBCursorWithValue,
    FDBDatabase as IDBDatabase,
    FDBFactory as IDBFactory,
    FDBIndex as IDBIndex,
    FDBKeyRange as IDBKeyRange,
    FDBObjectStore as IDBObjectStore,
    FDBOpenDBRequest as IDBOpenDBRequest,
    FDBRequest as IDBRequest,
    FDBTransaction as IDBTransaction,
    FDBVersionChangeEvent as IDBVersionChangeEvent,
} from "./inMemoryIdb"

async function deleteAllDatabases(): Promise<void> {
    const databases = await indexedDB.databases()
    for (const dbInfo of databases) {
        if (dbInfo.name) {
            await requestToPromise(
                indexedDB.deleteDatabase(dbInfo.name) as unknown as IDBRequest,
            )
        }
    }
}

export async function overrideIndexedDB() {
    const deletePromise = deleteAllDatabases()
    const port = await getMessagePort("indexedDB")
    await deletePromise
    const idb = new FDBFactory(port) as unknown as IDBFactory
    window.indexedDB = idb
    globalThis.indexedDB = idb
    window.IDBCursor = FDBCursor as unknown as {
        new (): IDBCursor
        prototype: IDBCursor
    }
    window.IDBCursorWithValue = FDBCursorWithValue as unknown as {
        new (): IDBCursorWithValue
        prototype: IDBCursorWithValue
    }
    window.IDBDatabase = FDBDatabase as unknown as {
        new (): IDBDatabase
        prototype: IDBDatabase
    }
    window.IDBFactory = FDBFactory as unknown as {
        new (): IDBFactory
        prototype: IDBFactory
    }
    window.IDBIndex = FDBIndex as unknown as {
        new (): IDBIndex
        prototype: IDBIndex
    }
    window.IDBKeyRange = FDBKeyRange as unknown as {
        new (): IDBKeyRange
        prototype: IDBKeyRange
        bound(
            lower: unknown,
            upper: unknown,
            lowerOpen?: boolean | undefined,
            upperOpen?: boolean | undefined,
        ): IDBKeyRange
        lowerBound(lower: unknown, open?: boolean | undefined): IDBKeyRange
        only(value: unknown): IDBKeyRange
        upperBound(upper: unknown, open?: boolean | undefined): IDBKeyRange
    }
    window.IDBObjectStore = FDBObjectStore as unknown as {
        new (): IDBObjectStore
        prototype: IDBObjectStore
    }
    window.IDBOpenDBRequest = FDBOpenDBRequest as unknown as {
        new (): IDBOpenDBRequest
        prototype: IDBOpenDBRequest
    }
    window.IDBRequest = FDBRequest as unknown as {
        new (): IDBRequest
        prototype: IDBRequest
    }
    window.IDBTransaction = FDBTransaction as unknown as {
        new (): IDBTransaction
        prototype: IDBTransaction
    }
    window.IDBVersionChangeEvent = FDBVersionChangeEvent as unknown as {
        new (): IDBVersionChangeEvent
        prototype: IDBVersionChangeEvent
    }
}
