import { default as FDBDatabase } from '../FDBDatabase';
import { default as FDBTransaction } from '../FDBTransaction';
import { default as ObjectStore } from './ObjectStore';
declare class Database {
    deletePending: boolean;
    readonly transactions: FDBTransaction[];
    readonly rawObjectStores: Map<string, ObjectStore>;
    connections: FDBDatabase[];
    readonly name: string;
    version: number;
    readonly _port: MessagePort;
    constructor(name: string, version: number, port: MessagePort);
    sync(): Promise<void>;
    processTransactions(): void;
}
export default Database;
