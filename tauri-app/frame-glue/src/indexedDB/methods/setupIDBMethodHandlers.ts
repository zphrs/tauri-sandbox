import { postMessagePort } from "../../SetupCrossthreadedPorts"
import { handleCloseDatabase } from "./closeDatabase"
import { handleDeleteDatabase } from "./deleteDatabase"
import { handleExecuteIDBTransactionMethod } from "./executeIDBTransaction"
import { handleGetDbInfo } from "./GetDbInfo"
import { handleGetIDBDatabaseStores } from "./GetIDBDatabaseStores"
import { handleOpenDatabase } from "./OpenIDBDatabase"
import { handleReadMethod } from "./readFromStore"

export async function setupIDBMethodHandlersFromPort(
    port: MessagePort,
    docId: string
) {
    handleGetDbInfo(port, docId)
    handleGetIDBDatabaseStores(port, docId)
    handleReadMethod(port, docId)
    handleExecuteIDBTransactionMethod(port, docId)
    handleOpenDatabase(port, docId)
    handleCloseDatabase(port, docId)
    handleDeleteDatabase(port, docId)
}

export async function setupIDBMethodHandlers(window: Window, docId: string) {
    const port = await postMessagePort("indexedDB", window)
    setupIDBMethodHandlersFromPort(port, docId)
}
