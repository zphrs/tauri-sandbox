import { IDBFactory } from '../../index';
import { requestToPromise } from '../../methods-parent-idb/readFromStore';
export { requestToPromise };
export declare const idb: IDBFactory;
export declare function cleanupDbRefAfterTest(db: IDBDatabase): Promise<void>;
export declare function createDatabase(t: {
    id?: string;
}, onUpgradeNeeded: (db: IDBDatabase, tx: IDBTransaction) => void): Promise<IDBDatabase>;
export declare function createNamedDatabase(_t: {
    id?: string;
}, dbname: string, onUpgradeNeeded: (db: IDBDatabase) => void): Promise<IDBDatabase>;
export declare function migrateNamedDatabase(_t: {
    id?: string;
}, dbname: string, newVersion: number, onUpgradeNeeded: (db: IDBDatabase, tx: IDBTransaction) => void): Promise<IDBDatabase>;
export declare function deleteAllDatabases(): Promise<void>;
