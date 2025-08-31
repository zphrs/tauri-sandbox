import { postMessagePort } from "../../SetupCrossthreadedPorts"
import type {
    HandlerWithDocId,
    OpenDatabaseMethod,
    CloseDatabaseMethod,
    DeleteDatabaseMethod,
    GetDbInfoMethod,
    GetDatabaseStoresMethod,
    ExecuteTransactionMethod,
    ExecuteReadMethod,
    ReadMethods,
} from "./types/index"

export type Methods = {
    openDatabase: OpenDatabaseMethod
    closeDatabase: CloseDatabaseMethod
    deleteDatabase: DeleteDatabaseMethod
    getDbInfo: GetDbInfoMethod
    getDatabaseStores: GetDatabaseStoresMethod
    executeRead: ExecuteReadMethod<ReadMethods>
    executeTransaction: ExecuteTransactionMethod
}
export type Handlers = {
    [method in keyof Methods]: HandlerWithDocId<Methods[method]>
}
import { handleRequests } from "../../rpcOverPorts"

export async function setupIndexedDBMethodHandlersFromPort(
    port: MessagePort,
    docId: string,
    handlers: Handlers,
) {
    for (const hn in handlers) {
        const handlerName = hn as keyof Handlers
        const handler = handlers[handlerName] as HandlerWithDocId<
            Methods[typeof handlerName]
        >
        handleRequests<Methods[typeof handlerName]>(
            port,
            handlerName,
            handler.bind(undefined, docId),
        )
    }
}

export async function setupIndexedDBMethodHandlers(
    window: Window,
    docId: string,
    handlers: Handlers,
) {
    const port = await postMessagePort("indexedDB", window)
    setupIndexedDBMethodHandlersFromPort(port, docId, handlers)
}
