import { default as FDBKeyRange } from './FDBKeyRange';
import { default as FDBObjectStore } from './FDBObjectStore';
import { default as FDBRequest } from './FDBRequest';
import { default as Index } from './lib/Index';
import { FDBCursorDirection, Key, KeyPath } from './lib/types';
declare class FDBIndex {
    _rawIndex: Index;
    objectStore: FDBObjectStore;
    keyPath: KeyPath;
    multiEntry: boolean;
    unique: boolean;
    private _name;
    constructor(objectStore: FDBObjectStore, rawIndex: Index);
    get name(): string;
    set name(name: string);
    openCursor(range?: FDBKeyRange | IDBValidKey | null, direction?: FDBCursorDirection): FDBRequest;
    openKeyCursor(range?: FDBKeyRange | IDBKeyRange | null, direction?: FDBCursorDirection): FDBRequest;
    get(key: FDBKeyRange | Key): FDBRequest;
    getAll(query?: FDBKeyRange | Key, count?: number): FDBRequest;
    getKey(key: FDBKeyRange | Key): FDBRequest;
    getAllKeys(query?: FDBKeyRange | Key, count?: number): FDBRequest;
    count(k: FDBKeyRange | IDBValidKey | null | undefined): FDBRequest;
    toString(): string;
}
export default FDBIndex;
