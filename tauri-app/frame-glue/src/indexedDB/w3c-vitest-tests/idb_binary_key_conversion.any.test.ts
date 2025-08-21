import { describe, expect, test } from "vitest"
import { FDBKeyRange as IDBKeyRange } from "../inMemoryIdb"

// Port of w3c test: idb_binary_key_conversion.any.js
// META: title=Verify the conversion of various types of BufferSource
// META: global=window,worker

// Spec: http://w3c.github.io/IndexedDB/#key-construct

describe("Binary key conversion tests", () => {
    test("Empty ArrayBuffer", () => {
        const binary = new ArrayBuffer(0)
        const key = IDBKeyRange.lowerBound(binary).lower

        expect(key).toBeInstanceOf(ArrayBuffer)
        expect((key as ArrayBuffer).byteLength).toBe(0)
        expect((key as ArrayBuffer).byteLength).toBe(binary.byteLength)
    })

    test("ArrayBuffer", () => {
        const binary = new ArrayBuffer(4)
        const dataView = new DataView(binary)
        dataView.setUint32(0, 1234567890)

        const key = IDBKeyRange.lowerBound(binary).lower

        expect(key).toBeInstanceOf(ArrayBuffer)
        expect((key as ArrayBuffer).byteLength).toBe(4)
        expect(dataView.getUint32(0)).toBe(
            new DataView(key as ArrayBuffer).getUint32(0),
        )
    })

    test("DataView", () => {
        const binary = new ArrayBuffer(4)
        const dataView = new DataView(binary)
        dataView.setUint32(0, 1234567890)

        const key = IDBKeyRange.lowerBound(dataView).lower

        expect(key).toBeInstanceOf(ArrayBuffer)
        expect((key as ArrayBuffer).byteLength).toBe(4)
        expect(dataView.getUint32(0)).toBe(
            new DataView(key as ArrayBuffer).getUint32(0),
        )
    })

    test("TypedArray(Int8Array)", () => {
        const binary = new ArrayBuffer(4)
        const int8Array = new Int8Array(binary)
        int8Array.set([16, -32, 64, -128])

        const key = IDBKeyRange.lowerBound(int8Array).lower
        const keyInInt8Array = new Int8Array(key as ArrayBuffer)

        expect(key).toBeInstanceOf(ArrayBuffer)
        expect((key as ArrayBuffer).byteLength).toBe(4)
        for (let i = 0; i < int8Array.length; i++) {
            expect(keyInInt8Array[i]).toBe(int8Array[i])
        }
    })

    test("Array of TypedArray(Int8Array)", () => {
        const binary = new ArrayBuffer(4)
        const int8Array = new Int8Array(binary)
        int8Array.set([16, -32, 64, -128])

        const key = IDBKeyRange.lowerBound([int8Array]).lower

        expect(key).toBeInstanceOf(Array)
        expect((key as unknown[])[0]).toBeInstanceOf(ArrayBuffer)
        expect(((key as unknown[])[0] as ArrayBuffer).byteLength).toBe(4)

        const keyInInt8Array = new Int8Array(
            (key as unknown[])[0] as ArrayBuffer,
        )

        for (let i = 0; i < int8Array.length; i++) {
            expect(keyInInt8Array[i]).toBe(int8Array[i])
        }
    })
})
