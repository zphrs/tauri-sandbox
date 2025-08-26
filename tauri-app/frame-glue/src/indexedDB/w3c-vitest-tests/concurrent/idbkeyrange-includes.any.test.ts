import { describe, test, expect } from "vitest"
import { FDBKeyRange as IDBKeyRange } from "../../inMemoryIdb"
import { DataError } from "../../inMemoryIdb/lib/errors"

// Port of w3c test: idbkeyrange-includes.any.js
// Tests IDBKeyRange.includes() method functionality

describe("IDBKeyRange.includes()", () => {
    test("with invalid input", () => {
        const range = IDBKeyRange.bound(12, 34)

        expect(() => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ;(range as any).includes()
        }).toThrow(TypeError)

        expect(() => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            range.includes(undefined as any)
        }).toThrow(DataError)

        expect(() => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            range.includes(null as any)
        }).toThrow(DataError)

        expect(() => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            range.includes({} as any)
        }).toThrow(DataError)

        expect(() => {
            range.includes(NaN)
        }).toThrow(DataError)

        expect(() => {
            range.includes(new Date(NaN))
        }).toThrow(DataError)

        expect(() => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const a: any[] = []
            a[0] = a
            range.includes(a)
        }).toThrow(DataError)
    })

    test("with a closed range", () => {
        const closedRange = IDBKeyRange.bound(5, 20)
        expect(!!closedRange.includes).toBe(true)
        expect(closedRange.includes(7)).toBe(true)
        expect(closedRange.includes(1)).toBe(false)
        expect(closedRange.includes(42)).toBe(false)
        expect(closedRange.includes(5.01)).toBe(true)
        expect(closedRange.includes(19.99)).toBe(true)
        expect(closedRange.includes(4.99)).toBe(false)
        expect(closedRange.includes(21.01)).toBe(false)

        expect(closedRange.includes(5)).toBe(true)
        expect(closedRange.includes(20)).toBe(true)
    })

    test("with an open range", () => {
        const closedRange = IDBKeyRange.bound(5, 20, true, true)
        expect(closedRange.includes(7)).toBe(true)
        expect(closedRange.includes(1)).toBe(false)
        expect(closedRange.includes(42)).toBe(false)
        expect(closedRange.includes(5.01)).toBe(true)
        expect(closedRange.includes(19.99)).toBe(true)
        expect(closedRange.includes(4.99)).toBe(false)
        expect(closedRange.includes(21.01)).toBe(false)

        expect(closedRange.includes(5)).toBe(false)
        expect(closedRange.includes(20)).toBe(false)
    })

    test("with a lower-open upper-closed range", () => {
        const range = IDBKeyRange.bound(5, 20, true)
        expect(range.includes(7)).toBe(true)
        expect(range.includes(1)).toBe(false)
        expect(range.includes(42)).toBe(false)
        expect(range.includes(5.01)).toBe(true)
        expect(range.includes(19.99)).toBe(true)
        expect(range.includes(4.99)).toBe(false)
        expect(range.includes(21.01)).toBe(false)

        expect(range.includes(5)).toBe(false)
        expect(range.includes(20)).toBe(true)
    })

    test("with a lower-closed upper-open range", () => {
        const range = IDBKeyRange.bound(5, 20, false, true)
        expect(range.includes(7)).toBe(true)
        expect(range.includes(1)).toBe(false)
        expect(range.includes(42)).toBe(false)
        expect(range.includes(5.01)).toBe(true)
        expect(range.includes(19.99)).toBe(true)
        expect(range.includes(4.99)).toBe(false)
        expect(range.includes(21.01)).toBe(false)

        expect(range.includes(5)).toBe(true)
        expect(range.includes(20)).toBe(false)
    })

    test("with an only range", () => {
        const onlyRange = IDBKeyRange.only(42)
        expect(onlyRange.includes(42)).toBe(true)
        expect(onlyRange.includes(1)).toBe(false)
        expect(onlyRange.includes(9000)).toBe(false)
        expect(onlyRange.includes(41)).toBe(false)
        expect(onlyRange.includes(43)).toBe(false)
    })

    test("with a closed lower-bounded range", () => {
        const range = IDBKeyRange.lowerBound(5)
        expect(range.includes(4)).toBe(false)
        expect(range.includes(5)).toBe(true)
        expect(range.includes(6)).toBe(true)
        expect(range.includes(42)).toBe(true)
    })

    test("with an open lower-bounded range", () => {
        const range = IDBKeyRange.lowerBound(5, true)
        expect(range.includes(4)).toBe(false)
        expect(range.includes(5)).toBe(false)
        expect(range.includes(6)).toBe(true)
        expect(range.includes(42)).toBe(true)
    })

    test("with a closed upper-bounded range", () => {
        const range = IDBKeyRange.upperBound(5)
        expect(range.includes(-42)).toBe(true)
        expect(range.includes(4)).toBe(true)
        expect(range.includes(5)).toBe(true)
        expect(range.includes(6)).toBe(false)
    })

    test("with an open upper-bounded range", () => {
        const range = IDBKeyRange.upperBound(5, true)
        expect(range.includes(-42)).toBe(true)
        expect(range.includes(4)).toBe(true)
        expect(range.includes(5)).toBe(false)
        expect(range.includes(6)).toBe(false)
    })

    test("with non-numeric keys", () => {
        expect(
            IDBKeyRange.bound(new Date(0), new Date()).includes(
                new Date(102729600000),
            ),
        ).toBe(true)
        expect(
            IDBKeyRange.bound(new Date(0), new Date(1e11)).includes(
                new Date(1e11 + 1),
            ),
        ).toBe(false)

        expect(IDBKeyRange.bound("a", "c").includes("b")).toBe(true)
        expect(IDBKeyRange.bound("a", "c").includes("d")).toBe(false)

        expect(IDBKeyRange.bound([], [[], []]).includes([[]])).toBe(true)
        expect(IDBKeyRange.bound([], [[]]).includes([[[]]])).toBe(false)
    })
})
