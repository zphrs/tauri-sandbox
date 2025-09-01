import { Method } from '../../../rpcOverPorts';
export type CloseDatabaseMethod = Method<"closeDatabase", {
    name: string;
}, null>;
export type DeleteDatabaseMethod = Method<"deleteDatabase", {
    name: string;
}, null>;
export type GetDbInfoMethod = Method<"getDbInfo", undefined, IDBDatabaseInfo[]>;
