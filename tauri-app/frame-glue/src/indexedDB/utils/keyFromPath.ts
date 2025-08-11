/**
 *
 * @param keyPath Assumes keyPath is a list of strings without any dots or is an
 * empty list in which case the topmost value is keyPath
 * coordx => {coord: {x: 2, y:0}} => 2
 * @param value
 */

import { createError } from "../exceptions"

// http://www.w3.org/TR/2015/REC-IndexedDB-20150108/#dfn-steps-for-extracting-a-key-from-a-value-using-a-key-path
const extractKey = (
    keyPath: string | string[],
    value: any
): IDBValidKey | undefined => {
    if (Array.isArray(keyPath)) {
        const result: any[] = []

        for (let item of keyPath) {
            // This doesn't make sense to me based on the spec, but it is needed to pass the W3C KeyPath tests (see same
            // comment in validateKeyPath)
            if (
                item !== undefined &&
                item !== null &&
                typeof item !== "string" &&
                (item as any).toString
            ) {
                item = (item as any).toString()
            }
            const key = extractKey(item, value)
            result.push(key)
        }

        return valueToKey(result)
    }

    if (keyPath === "") {
        return value
    }

    let remainingKeyPath: string | null = keyPath
    let object = value

    while (remainingKeyPath !== null) {
        let identifier

        const i = remainingKeyPath.indexOf(".")
        if (i >= 0) {
            identifier = remainingKeyPath.slice(0, i)
            remainingKeyPath = remainingKeyPath.slice(i + 1)
        } else {
            identifier = remainingKeyPath
            remainingKeyPath = null
        }

        if (
            object === undefined ||
            object === null ||
            !Object.hasOwn(object, identifier)
        ) {
            return undefined
        }

        object = object[identifier]
    }

    return object
}

export function keyFromPath(path: string | string[], value: any) {
    const k = extractKey(path, value)
    if (k === undefined) throw createError("Data")
    return valueToKey(k)
}

// https://w3c.github.io/IndexedDB/#convert-value-to-key
const valueToKey = (input: any, seen?: Set<object>): IDBValidKey => {
    if (typeof input === "number") {
        if (isNaN(input)) {
            throw createError("Data")
        }
        return input
    } else if (Object.prototype.toString.call(input) === "[object Date]") {
        const ms = input.valueOf()
        if (isNaN(ms)) {
            throw createError("Data")
        }
        return new Date(ms)
    } else if (typeof input === "string") {
        return input
    } else if (
        input instanceof ArrayBuffer ||
        (typeof SharedArrayBuffer !== "undefined" &&
            input instanceof SharedArrayBuffer) ||
        (typeof ArrayBuffer !== "undefined" &&
            ArrayBuffer.isView &&
            ArrayBuffer.isView(input))
    ) {
        let arrayBuffer
        let offset = 0
        let length = 0
        if (
            input instanceof ArrayBuffer ||
            (typeof SharedArrayBuffer !== "undefined" &&
                input instanceof SharedArrayBuffer)
        ) {
            arrayBuffer = input
            length = input.byteLength
        } else {
            arrayBuffer = input.buffer
            offset = input.byteOffset
            length = input.byteLength
        }

        if ((arrayBuffer as any).detached) {
            return new ArrayBuffer(0)
        }

        return arrayBuffer.slice(offset, offset + length)
    } else if (Array.isArray(input)) {
        if (seen === undefined) {
            seen = new Set()
        } else if (seen.has(input)) {
            throw createError("Data")
        }
        seen.add(input)

        const keys = []
        for (let i = 0; i < input.length; i++) {
            const hop = Object.hasOwn(input, i)
            if (!hop) {
                throw createError("Data")
            }
            const entry = input[i]
            const key = valueToKey(entry, seen)
            keys.push(key)
        }
        return keys
    } else {
        throw createError("Data")
    }
}

export default valueToKey
