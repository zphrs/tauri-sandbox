import { describe, expect, test } from "vitest"
import {
    FDBRequest,
    FDBVersionChangeEvent,
    FDBDatabase,
    FDBCursor,
    FDBTransaction,
} from "../../index"

// Port of w3c test: historical.any.js
// META: title=IndexedDB: Historical features
describe("historical", () => {
    test('"errorCode" should not be supported on IDBRequest.', () => {
        // Replaced circa December 2011 by 'error'.
        expect("errorCode" in FDBRequest.prototype).toBe(false)
    })

    test('"LOADING" should not be supported on IDBRequest.', () => {
        // Replaced circa May 2012 by a DOMString (later, IDBRequestReadyState enum).
        expect("LOADING" in FDBRequest).toBe(false)
    })

    test('"DONE" should not be supported on IDBRequest.', () => {
        // Replaced circa May 2012 by a DOMString (later, IDBRequestReadyState enum).
        expect("DONE" in FDBRequest).toBe(false)
    })

    test('"version" should not be supported on IDBVersionChangeEvent.', () => {
        // Replaced circa December 2011 by 'oldVersion'/'newVersion'.
        expect("version" in FDBVersionChangeEvent.prototype).toBe(false)
    })

    test('"setVersion" should not be supported on IDBDatabase.', () => {
        // Replaced circa December 2011 by open() with version.
        expect("setVersion" in FDBDatabase.prototype).toBe(false)
    })

    test('"NEXT" should not be supported on IDBCursor.', () => {
        // Replaced circa May 2012 by a DOMString (later, IDBCursorDirection enum).
        expect("NEXT" in FDBCursor).toBe(false)
    })

    test('"NEXT_NO_DUPLICATE" should not be supported on IDBCursor.', () => {
        // Replaced circa May 2012 by a DOMString (later, IDBCursorDirection enum).
        expect("NEXT_NO_DUPLICATE" in FDBCursor).toBe(false)
    })

    test('"PREV" should not be supported on IDBCursor.', () => {
        // Replaced circa May 2012 by a DOMString (later, IDBCursorDirection enum).
        expect("PREV" in FDBCursor).toBe(false)
    })

    test('"PREV_NO_DUPLICATE" should not be supported on IDBCursor.', () => {
        // Replaced circa May 2012 by a DOMString (later, IDBCursorDirection enum).
        expect("PREV_NO_DUPLICATE" in FDBCursor).toBe(false)
    })

    test('"READ_ONLY" should not be supported on IDBTransaction.', () => {
        // Replaced circa May 2012 by a DOMString (later, IDBTransactionMode enum).
        expect("READ_ONLY" in FDBTransaction).toBe(false)
    })

    test('"READ_WRITE" should not be supported on IDBTransaction.', () => {
        // Replaced circa May 2012 by a DOMString (later, IDBTransactionMode enum).
        expect("READ_WRITE" in FDBTransaction).toBe(false)
    })

    test('"VERSION_CHANGE" should not be supported on IDBTransaction.', () => {
        // Replaced circa May 2012 by a DOMString (later, IDBTransactionMode enum).
        expect("VERSION_CHANGE" in FDBTransaction).toBe(false)
    })

    // Gecko-proprietary interfaces.
    const removedFromWindow = [
        "IDBFileHandle",
        "IDBFileRequest",
        "IDBMutableFile",
    ]

    removedFromWindow.forEach((name) => {
        test(`"${name}" should not be supported`, () => {
            expect(name in globalThis).toBe(false)
        })
    })
})
