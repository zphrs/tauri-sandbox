import { default as FDBDatabase } from './FDBDatabase';
import { default as FDBOpenDBRequest } from './FDBOpenDBRequest';
import { UpgradeActions } from '../methods-scaffolding/types/';
declare class FDBFactory {
    _port: MessagePort;
    cmp: (first: any, second: any) => -1 | 0 | 1;
    private _databases;
    constructor(port: MessagePort);
    deleteDatabase(name: string): FDBOpenDBRequest;
    open(name: string, version?: number): FDBOpenDBRequest;
    databases(): Promise<IDBDatabaseInfo[]>;
    toString(): string;
}
export default FDBFactory;
export declare function callOpenDatabase(connection: FDBDatabase, upgradeActions: UpgradeActions[]): Promise<void>;
