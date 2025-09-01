import { Method, Notification } from '../../../rpcOverPorts';
import { SerializedQuery } from '../SerializedRange';
export type GetAllKeys = Notification<"getAllKeys", {
    query?: SerializedQuery;
    count?: number;
}>;
export type GetAllRecords = Notification<"getAllRecords", {
    query?: SerializedQuery;
    count?: number;
}>;
export type GetAllRecordsFromIndex = Notification<"getAllRecordsFromIndex", {
    indexName: string;
    query?: SerializedQuery;
    count?: number;
}>;
export type GetNextFromCursor = Notification<"getNextFromCursor", {
    range: SerializedQuery | undefined;
    direction: IDBCursorDirection;
    indexName?: string;
    currPrimaryKey?: IDBValidKey | undefined;
    prevPrimaryKey?: IDBValidKey | undefined;
    justKeys: boolean;
}>;
export type Read = GetAllKeys | GetAllRecords | GetAllRecordsFromIndex | GetNextFromCursor;
export type GetAllKeysMethod = ReadMethod<GetAllKeys, IDBValidKey[]>;
export type GetAllRecordsMethod = ReadMethod<GetAllRecords, [
    unknown[],
    GetAllKeysMethod["res"]["result"]
]>;
export type GetAllRecordsFromIndexMethod = ReadMethod<GetAllRecordsFromIndex, [
    unknown[],
    IDBValidKey[]
]>;
export type GetNextFromCursorMethod = ReadMethod<GetNextFromCursor, {
    key: IDBValidKey;
    value: unknown;
    primaryKey: IDBValidKey;
} | undefined>;
export type ReadMethods = GetAllKeysMethod | GetAllRecordsMethod | GetAllRecordsFromIndexMethod | GetNextFromCursorMethod;
export type ExecuteReadMethod<M extends ReadMethods> = M;
type ReadMethod<R extends Read, Return> = Method<"executeRead", {
    call: R;
    dbName: string;
    store: string;
}, Return>;
export {};
