import { describe, test, expect } from "vitest"
import { FDBKeyRange as IDBKeyRange } from "../../inMemoryIdb"
import { DataError } from "../../inMemoryIdb/lib/errors"

// Port of w3c test: idbkeyrange_incorrect.any.js
// Tests IDBKeyRange.bound() error conditions

describe("IDBKeyRange.bound() - incorrect usage", () => {
    test("bound requires more than 0 arguments", () => {
        expect(() => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ;(IDBKeyRange.bound as any)()
        }).toThrow(TypeError)
    })

    test("null parameters are incorrect", () => {
        expect(() => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            IDBKeyRange.bound(null as any, null as any)
        }).toThrow(DataError)
    })

    test("null parameter is incorrect", () => {
        expect(() => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            IDBKeyRange.bound(1, null as any)
        }).toThrow(DataError)

        expect(() => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            IDBKeyRange.bound(null as any, 1)
        }).toThrow(DataError)
    })

    test("lower is greater than upper", () => {
        const lowerBad = Math.floor(Math.random() * 31) + 5
        const upper = lowerBad - 1

        expect(() => {
            IDBKeyRange.bound(lowerBad, upper)
        }).toThrow(DataError)

        expect(() => {
            IDBKeyRange.bound("b", "a")
        }).toThrow(DataError)
    })

    test("mixed key types - DOMString/Date/Array greater than float", () => {
        expect(() => {
            IDBKeyRange.bound("a", 1)
        }).toThrow(DataError)

        expect(() => {
            IDBKeyRange.bound(new Date(), 1)
        }).toThrow(DataError)

        expect(() => {
            IDBKeyRange.bound([1, 2], 1)
        }).toThrow(DataError)
    })

    test("boolean is not a valid key type", () => {
        expect(() => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            IDBKeyRange.bound(true as any, 1)
        }).toThrow(DataError)
    })
})
