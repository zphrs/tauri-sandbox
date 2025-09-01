// changed by @zphrs

import FDBCursor from "./FDBCursor"
import type FDBRequest from "./FDBRequest"
import type {
    CursorRange,
    CursorSource,
    FDBCursorDirection,
    Value,
} from "./lib/types"

class FDBCursorWithValue extends FDBCursor {
    public value: Value = undefined

    constructor(
        source: CursorSource,
        range: CursorRange,
        direction?: FDBCursorDirection,
        request?: FDBRequest,
    ) {
        super(source, range, direction, request)
    }

    public toString() {
        return "[object IDBCursorWithValue]"
    }
}

export default FDBCursorWithValue
