import { Handlers } from '../methods-scaffolding/setupIDBMethodHandlers';
export declare const openedDbs: Record<string, {
    db: IDBDatabase;
    count: number;
}>;
export declare const openDatabaseHandler: Handlers["openDatabase"];
export declare function handleOpenDatabase(port: MessagePort, docId: string): void;
