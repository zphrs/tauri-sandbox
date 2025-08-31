import { type Method } from "../../../rpcOverPorts"

// Types from closeDatabase.ts
export type CloseDatabaseMethod = Method<
    "closeDatabase",
    { name: string },
    null
>

// Types from deleteDatabase.ts
export type DeleteDatabaseMethod = Method<
    "deleteDatabase",
    { name: string },
    null
>

// Types from GetDbInfo.ts
export type GetDbInfoMethod = Method<"getDbInfo", undefined, IDBDatabaseInfo[]>
