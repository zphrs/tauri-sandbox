import { default as FDBKeyRange } from '../FDBKeyRange';
import { Key, Record } from './types';
declare class RecordStore {
    private records;
    private keyModificationSet;
    private deletedKeyRanges;
    constructor(isModificationSet?: boolean);
    get(key: Key | FDBKeyRange): Record | undefined;
    cleanupAfterCompletedTransaction(): void;
    private addToModifications;
    modified(key: Key): boolean;
    add(newRecord: Record): void;
    private set;
    delete(key: Key): Record[];
    deleteByValue(key: Key): Record[];
    clear(recordTombstones?: boolean): Record[];
    values(range?: FDBKeyRange, direction?: "next" | "prev"): {
        [Symbol.iterator]: () => {
            next: () => IteratorResult<Record>;
        };
    };
}
export default RecordStore;
