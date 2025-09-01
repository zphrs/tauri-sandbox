import { Key } from './lib/types';
declare class FDBKeyRange {
    static only(value: Key): FDBKeyRange;
    static lowerBound(lower: Key, open?: boolean): FDBKeyRange;
    static upperBound(upper: Key, open?: boolean): FDBKeyRange;
    static bound(lower: IDBValidKey, upper: IDBValidKey, lowerOpen?: boolean, upperOpen?: boolean): FDBKeyRange;
    readonly lower: IDBValidKey | undefined;
    readonly upper: IDBValidKey | undefined;
    lowerOpen: boolean;
    upperOpen: boolean;
    constructor(lower: IDBValidKey | undefined, upper: IDBValidKey | undefined, lowerOpen: boolean, upperOpen: boolean);
    includes(key: Key): boolean;
    toString(): string;
}
export default FDBKeyRange;
