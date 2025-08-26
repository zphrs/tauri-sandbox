import { describe, test, expect } from "vitest"
import { idb } from "../resources/createDatabase"
import { DataError } from "../../inMemoryIdb/lib/errors"

// Port of w3c test: idbfactory_cmp.any.js
// Tests IDBFactory.cmp()

describe("IDBFactory.cmp()", () => {
    test("compared keys return correct value", () => {
        expect(idb.cmp(2, 1)).toBe(1)
        expect(idb.cmp(2, 2)).toBe(0)
        expect(idb.cmp(1, 2)).toBe(-1)
    })

    test("no argument", () => {
        expect(() => (idb.cmp as unknown as () => void)()).toThrow(TypeError)
    })

    test("null", () => {
        expect(() => idb.cmp(null as unknown, null as unknown)).toThrow(
            DOMException,
        )
        expect(() => idb.cmp(null as unknown, null as unknown)).toThrow(
            DataError,
        )
    })

    test("NaN", () => {
        expect(() => idb.cmp(NaN, NaN)).toThrow(DOMException)
        expect(() => idb.cmp(NaN, NaN)).toThrow(DataError)
        expect(() => idb.cmp(1, NaN)).toThrow(DOMException)
        expect(() => idb.cmp(1, NaN)).toThrow(DataError)
        expect(() => idb.cmp(NaN, 1)).toThrow(DOMException)
        expect(() => idb.cmp(NaN, 1)).toThrow(DataError)
    })

    test("Array vs. Binary", () => {
        expect(idb.cmp([0], new Uint8Array([0]))).toBe(1)
    })

    test("Binary vs. String", () => {
        expect(idb.cmp(new Uint8Array([0]), "0")).toBe(1)
    })

    test("String vs. Date", () => {
        expect(idb.cmp("", new Date(0))).toBe(1)
    })

    test("Date vs. Number", () => {
        expect(idb.cmp(new Date(0), 0)).toBe(1)
    })

    test("Compare in unsigned octet values (in the range [0, 255])", () => {
        expect(idb.cmp(new Int8Array([-1]), new Uint8Array([0]))).toBe(1)
    })

    test("Compare values of the same length", () => {
        expect(
            idb.cmp(
                new Uint8Array([255, 254, 253]),
                new Uint8Array([255, 253, 254]),
            ),
        ).toBe(1)
    })

    test("Compare values of different lengths", () => {
        expect(
            idb.cmp(
                new Uint8Array([255, 254]),
                new Uint8Array([255, 253, 254]),
            ),
        ).toBe(1)
    })

    test("Compare when values in the range of their minimal length are the same", () => {
        expect(
            idb.cmp(
                new Uint8Array([255, 253, 254]),
                new Uint8Array([255, 253]),
            ),
        ).toBe(1)
    })
})
