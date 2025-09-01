import { getMessagePort } from "../SetupCrossthreadedPorts"
import { FDBFactory } from "./inMemoryIdb"
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

export async function overrideIndexedDB() {
    const port = await getMessagePort("indexedDB")
    const idb = new FDBFactory(port) as unknown as IDBFactory
    window.indexedDB = idb
    globalThis.indexedDB = idb
}
