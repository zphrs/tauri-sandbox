import { postMessagePort } from "../../SetupCrossthreadedPorts"
import { handleExecuteIDBTransactionMethod } from "./executeIDBTransaction"
import { handleGetDbInfo } from "./GetDbInfo"
import { handleGetIDBDatabaseStores } from "./GetIDBDatabaseStores"
import { handleOpenDatabase } from "./OpenIDBDatabase"
import { handleReadMethod } from "./readFromStore"

export async function setupIDBMethodHandlersFromPort(
    port: MessagePort,
    docId: string,
) {
    handleGetDbInfo(port, docId)
    handleGetIDBDatabaseStores(port, docId)
    handleReadMethod(port, docId)
    handleExecuteIDBTransactionMethod(port, docId)
    handleOpenDatabase(port, docId)
}

export async function setupIDBMethodHandlers(window: Window, docId: string) {
    const port = await postMessagePort("indexedDB", window)
    setupIDBMethodHandlersFromPort(port, docId)
}
