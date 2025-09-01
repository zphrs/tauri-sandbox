import { default as FDBCursor } from './FDBCursor';
import { default as FDBRequest } from './FDBRequest';
import { CursorRange, CursorSource, FDBCursorDirection, Value } from './lib/types';
declare class FDBCursorWithValue extends FDBCursor {
    value: Value;
    constructor(source: CursorSource, range: CursorRange, direction?: FDBCursorDirection, request?: FDBRequest);
    toString(): string;
}
export default FDBCursorWithValue;
