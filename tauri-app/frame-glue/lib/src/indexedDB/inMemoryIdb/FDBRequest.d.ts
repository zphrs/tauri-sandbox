import { default as FDBCursor } from './FDBCursor';
import { default as FDBIndex } from './FDBIndex';
import { default as FDBObjectStore } from './FDBObjectStore';
import { default as FDBTransaction } from './FDBTransaction';
import { default as FakeEventTarget } from './lib/FakeEventTarget';
import { EventCallback } from './lib/types';
declare class FDBRequest extends FakeEventTarget {
    _result: any;
    _error: Error | null | undefined;
    source: FDBCursor | FDBIndex | FDBObjectStore | null;
    transaction: FDBTransaction | null;
    readyState: "done" | "pending";
    onsuccess: EventCallback | null;
    onerror: EventCallback | null;
    get error(): Error | null | undefined;
    set error(value: Error | null | undefined);
    get result(): any;
    set result(value: any);
    toString(): string;
}
export default FDBRequest;
