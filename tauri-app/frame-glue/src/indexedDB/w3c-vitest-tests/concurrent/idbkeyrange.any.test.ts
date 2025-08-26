import { describe, test, expect } from "vitest"
import { FDBKeyRange as IDBKeyRange } from "../../inMemoryIdb"
import { DataError } from "../../inMemoryIdb/lib/errors"

// Port of w3c test: idbkeyrange.any.js
// Tests IDBKeyRange static methods functionality

describe("IDBKeyRange", () => {
    describe("only()", () => {
        test("returns an IDBKeyRange and the properties are set correctly", () => {
            const keyRange = IDBKeyRange.only(1)
            expect(keyRange).toBeInstanceOf(IDBKeyRange)
            expect(keyRange.lower).toBe(1)
            expect(keyRange.upper).toBe(1)
            expect(keyRange.lowerOpen).toBe(false)
            expect(keyRange.upperOpen).toBe(false)
        })

        test("throws on invalid keys", () => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            expect(() => IDBKeyRange.only(undefined as any)).toThrow(DataError)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            expect(() => IDBKeyRange.only(null as any)).toThrow(DataError)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            expect(() => IDBKeyRange.only({} as any)).toThrow(DataError)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            expect(() => IDBKeyRange.only(Symbol() as any)).toThrow(DataError)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            expect(() => IDBKeyRange.only(true as any)).toThrow(DataError)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            expect(() => IDBKeyRange.only((() => {}) as any)).toThrow(DataError)
        })
    })

    describe("lowerBound()", () => {
        test("returns an IDBKeyRange and the properties are set correctly", () => {
            const keyRange = IDBKeyRange.lowerBound(1, true)
            expect(keyRange).toBeInstanceOf(IDBKeyRange)
            expect(keyRange.lower).toBe(1)
            expect(keyRange.upper).toBeUndefined()
            expect(keyRange.lowerOpen).toBe(true)
            expect(keyRange.upperOpen).toBe(true)
        })

        test("'open' parameter has correct default set", () => {
            const keyRange = IDBKeyRange.lowerBound(1)
            expect(keyRange.lowerOpen).toBe(false)
        })

        test("throws on invalid keys", () => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            expect(() => IDBKeyRange.lowerBound(undefined as any)).toThrow(
                DataError,
            )
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            expect(() => IDBKeyRange.lowerBound(null as any)).toThrow(DataError)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            expect(() => IDBKeyRange.lowerBound({} as any)).toThrow(DataError)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            expect(() => IDBKeyRange.lowerBound(Symbol() as any)).toThrow(
                DataError,
            )
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            expect(() => IDBKeyRange.lowerBound(true as any)).toThrow(DataError)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            expect(() => IDBKeyRange.lowerBound((() => {}) as any)).toThrow(
                DataError,
            )
        })
    })

    describe("upperBound()", () => {
        test("returns an IDBKeyRange and the properties are set correctly", () => {
            const keyRange = IDBKeyRange.upperBound(1, true)
            expect(keyRange).toBeInstanceOf(IDBKeyRange)
            expect(keyRange.lower).toBeUndefined()
            expect(keyRange.upper).toBe(1)
            expect(keyRange.lowerOpen).toBe(true)
            expect(keyRange.upperOpen).toBe(true)
        })

        test("'open' parameter has correct default set", () => {
            const keyRange = IDBKeyRange.upperBound(1)
            expect(keyRange.upperOpen).toBe(false)
        })

        test("throws on invalid keys", () => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            expect(() => IDBKeyRange.upperBound(undefined as any)).toThrow(
                DataError,
            )
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            expect(() => IDBKeyRange.upperBound(null as any)).toThrow(DataError)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            expect(() => IDBKeyRange.upperBound({} as any)).toThrow(DataError)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            expect(() => IDBKeyRange.upperBound(Symbol() as any)).toThrow(
                DataError,
            )
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            expect(() => IDBKeyRange.upperBound(true as any)).toThrow(DataError)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            expect(() => IDBKeyRange.upperBound((() => {}) as any)).toThrow(
                DataError,
            )
        })
    })

    describe("bound()", () => {
        test("returns an IDBKeyRange and the properties are set correctly", () => {
            const keyRange = IDBKeyRange.bound(1, 2, true, true)
            expect(keyRange).toBeInstanceOf(IDBKeyRange)
            expect(keyRange.lower).toBe(1)
            expect(keyRange.upper).toBe(2)
            expect(keyRange.lowerOpen).toBe(true)
            expect(keyRange.upperOpen).toBe(true)
        })

        test("'lowerOpen' and 'upperOpen' parameters have correct defaults set", () => {
            const keyRange = IDBKeyRange.bound(1, 2)
            expect(keyRange.lowerOpen).toBe(false)
            expect(keyRange.upperOpen).toBe(false)
        })
    })
})
