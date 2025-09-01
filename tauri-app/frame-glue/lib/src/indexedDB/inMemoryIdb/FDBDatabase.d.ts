import { default as FDBTransaction } from './FDBTransaction';
import { default as Database } from './lib/Database';
import { default as FakeDOMStringList } from './lib/FakeDOMStringList';
import { default as FakeEventTarget } from './lib/FakeEventTarget';
import { KeyPath, TransactionMode } from './lib/types';
declare class FDBDatabase extends FakeEventTarget {
    _closePending: boolean;
    _closed: boolean;
    _runningVersionchangeTransaction: boolean;
    _rawDatabase: Database;
    name: string;
    version: number;
    objectStoreNames: FakeDOMStringList;
    constructor(rawDatabase: Database);
    createObjectStore(name: string, options?: {
        autoIncrement?: boolean;
        keyPath?: KeyPath;
    } | null): import('./FDBObjectStore').default;
    deleteObjectStore(name: string): void;
    transaction(storeNames: string | string[], mode?: TransactionMode, internalRequest?: boolean): FDBTransaction;
    close(): void;
    toString(): string;
}
export default FDBDatabase;
