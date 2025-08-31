import type { Handlers } from "../methods-scaffolding/setupIDBMethodHandlers"
import { closeDatabaseHandler } from "./closeDatabase"
import { deleteDatabaseHandler } from "./deleteDatabase"
import { executeTransactionHandler } from "./executeIDBTransaction"
import { getDbInfoHandler } from "./GetDbInfo"
import { getDatabaseStoresHandler } from "./GetIDBDatabaseStores"
import { openDatabaseHandler } from "./OpenDatabase"
import { executeReadHandler } from "./readFromStore"

export {
    setupIDBMethodHandlers,
    setupIDBMethodHandlersFromPort,
} from "./setupIDBMethodHandlers"

export const handlers: Handlers = {
    openDatabase: openDatabaseHandler,
    closeDatabase: closeDatabaseHandler,
    deleteDatabase: deleteDatabaseHandler,
    getDbInfo: getDbInfoHandler,
    getDatabaseStores: getDatabaseStoresHandler,
    executeRead: executeReadHandler,
    executeTransaction: executeTransactionHandler,
}
