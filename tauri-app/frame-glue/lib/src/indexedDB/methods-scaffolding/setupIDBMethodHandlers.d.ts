import { HandlerWithDocId, OpenDatabaseMethod, CloseDatabaseMethod, DeleteDatabaseMethod, GetDbInfoMethod, GetDatabaseStoresMethod, ExecuteTransactionMethod, ExecuteReadMethod, ReadMethods } from './types/index';
export type Methods = {
    openDatabase: OpenDatabaseMethod;
    closeDatabase: CloseDatabaseMethod;
    deleteDatabase: DeleteDatabaseMethod;
    getDbInfo: GetDbInfoMethod;
    getDatabaseStores: GetDatabaseStoresMethod;
    executeRead: ExecuteReadMethod<ReadMethods>;
    executeTransaction: ExecuteTransactionMethod;
};
export type Handlers = {
    [method in keyof Methods]: HandlerWithDocId<Methods[method]>;
};
export declare function setupIndexedDBMethodHandlersFromPort(port: MessagePort, docId: string, handlers: Handlers): Promise<void>;
export declare function setupIndexedDBMethodHandlers(window: Window, docId: string, handlers: Handlers): Promise<void>;
