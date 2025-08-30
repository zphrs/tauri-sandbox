import { expect } from "vitest"
import { createDatabase, requestToPromise } from "./createDatabase"

// Should be large enough to trigger large value handling in the IndexedDB
// engines that have special code paths for large values.
export const wrapThreshold = 128 * 1024

// When `seed` is non-zero, the data is pseudo-random, otherwise it is repetitive.
// The PRNG should be sufficient to defeat compression schemes, but it is not
// cryptographically strong.
export function largeValue(size: number, seed: number): Uint8Array {
    const buffer = new Uint8Array(new ArrayBuffer(size))
    // Fill with a lot of the same byte.
    if (seed == 0) {
        buffer.fill(0x11, 0, size - 1)
        return buffer
    }

    // 32-bit xorshift - the seed can't be zero
    let state = 1000 + seed

    for (let i = 0; i < size; ++i) {
        state ^= state << 13
        state ^= state >> 17
        state ^= state << 5
        buffer[i] = state & 0xff
    }

    return buffer
}

// Descriptor types
export interface BlobDescriptor {
    type: "blob"
    size: number
    mimeType: string
    seed: number
}

export interface BufferDescriptor {
    type: "buffer"
    size: number
    seed: number
}

// We use unknown for recursive types to avoid circular reference
export type ValueDescriptor =
    | BlobDescriptor
    | BufferDescriptor
    | Record<string, unknown>
    | unknown[]
    | string
    | number
    | boolean
    | null

// Returns an IndexedDB value created from a descriptor.
export function createValue(descriptor: ValueDescriptor): unknown {
    if (typeof descriptor !== "object" || descriptor === null) {
        return descriptor
    }

    if (Array.isArray(descriptor)) {
        return descriptor.map((element) =>
            createValue(element as ValueDescriptor),
        )
    }

    if (!("type" in descriptor)) {
        const value: Record<string, unknown> = {}
        for (const property of Object.getOwnPropertyNames(descriptor)) {
            value[property] = createValue(
                (descriptor as Record<string, unknown>)[
                    property
                ] as ValueDescriptor,
            )
        }
        return value
    }

    const typedDescriptor = descriptor as BlobDescriptor | BufferDescriptor
    switch (typedDescriptor.type) {
        case "blob": {
            const blobDescriptor = typedDescriptor as BlobDescriptor
            const buffer = largeValue(blobDescriptor.size, blobDescriptor.seed)
            return new Blob([buffer as BlobPart], {
                type: blobDescriptor.mimeType,
            })
        }
        case "buffer": {
            const bufferDescriptor = typedDescriptor as BufferDescriptor
            return largeValue(bufferDescriptor.size, bufferDescriptor.seed)
        }
        default:
            throw new Error(
                `Unknown descriptor type: ${
                    (typedDescriptor as Record<string, unknown>).type
                }`,
            )
    }
}

// Helper function to check if an object is a Blob
function isBlob(value: unknown): value is Blob {
    return value instanceof Blob
}

// Helper function to check if an object is a Uint8Array
function isUint8Array(value: unknown): value is Uint8Array {
    return value instanceof Uint8Array
}

// Checks an IndexedDB value against a descriptor.
// Returns a Promise that resolves if the value passes the check.
export async function checkValue(
    value: unknown,
    descriptor: ValueDescriptor,
): Promise<void> {
    if (typeof descriptor !== "object" || descriptor === null) {
        expect(value).toBe(descriptor)
        return
    }

    if (Array.isArray(descriptor)) {
        expect(Array.isArray(value)).toBe(true)
        const arrayValue = value as unknown[]
        expect(arrayValue.length).toBe(descriptor.length)

        for (let i = 0; i < descriptor.length; i++) {
            await checkValue(arrayValue[i], descriptor[i] as ValueDescriptor)
        }
        return
    }

    if (!("type" in descriptor)) {
        expect(
            Object.getOwnPropertyNames(value as Record<string, unknown>).sort(),
        ).toEqual(Object.getOwnPropertyNames(descriptor).sort())

        const objectValue = value as Record<string, unknown>
        const objectDescriptor = descriptor as Record<string, unknown>
        for (const property of Object.getOwnPropertyNames(descriptor)) {
            await checkValue(
                objectValue[property],
                objectDescriptor[property] as ValueDescriptor,
            )
        }
        return
    }

    const typedDescriptor = descriptor as BlobDescriptor | BufferDescriptor
    switch (typedDescriptor.type) {
        case "blob": {
            const blobDescriptor = typedDescriptor as BlobDescriptor
            expect(isBlob(value)).toBe(true)
            const blobValue = value as Blob
            expect(blobValue.type).toBe(blobDescriptor.mimeType)
            expect(blobValue.size).toBe(blobDescriptor.size)

            const arrayBuffer = await blobValue.arrayBuffer()
            const view = new Uint8Array(arrayBuffer)
            const expectedContent = largeValue(
                blobDescriptor.size,
                blobDescriptor.seed,
            )
            expect(Array.from(view)).toEqual(Array.from(expectedContent))
            break
        }
        case "buffer": {
            const bufferDescriptor = typedDescriptor as BufferDescriptor
            expect(isUint8Array(value)).toBe(true)
            const bufferValue = value as Uint8Array
            const expectedBuffer = largeValue(
                bufferDescriptor.size,
                bufferDescriptor.seed,
            )
            expect(Array.from(bufferValue)).toEqual(Array.from(expectedBuffer))
            break
        }
        default:
            throw new Error(
                `Unknown descriptor type: ${
                    (typedDescriptor as Record<string, unknown>).type
                }`,
            )
    }
}

interface CloningTestOptions {
    useKeyGenerator: boolean
}

async function cloningTestInternal(
    valueDescriptors: ValueDescriptor[],
    options: CloningTestOptions,
    task: { id?: string },
): Promise<void> {
    const db = await createDatabase(task, (database) => {
        let store: IDBObjectStore
        if (options.useKeyGenerator) {
            store = database.createObjectStore("test-store", {
                keyPath: "primaryKey",
                autoIncrement: true,
            })
        } else {
            store = database.createObjectStore("test-store")
        }

        for (let i = 0; i < valueDescriptors.length; i++) {
            if (options.useKeyGenerator) {
                store.put(createValue(valueDescriptors[i]))
            } else {
                store.put(createValue(valueDescriptors[i]), i + 1)
            }
        }
    })

    // Test individual gets - each needs its own transaction
    for (let i = 0; i < valueDescriptors.length; i++) {
        const transaction = db.transaction(["test-store"], "readonly")
        const store = transaction.objectStore("test-store")
        const primaryKey = i + 1
        const request = store.get(primaryKey)

        const result = await requestToPromise(request)

        if (options.useKeyGenerator) {
            expect((result as Record<string, unknown>).primaryKey).toBe(
                primaryKey,
            )
            delete (result as Record<string, unknown>).primaryKey
        }

        await checkValue(result, valueDescriptors[i])
    }

    // Test getAll with a new transaction
    const getAllTransaction = db.transaction(["test-store"], "readonly")
    const getAllStore = getAllTransaction.objectStore("test-store")
    const getAllRequest = getAllStore.getAll()
    const getAllResult = await requestToPromise(getAllRequest)

    if (options.useKeyGenerator) {
        const arrayResult = getAllResult as Record<string, unknown>[]
        for (let i = 0; i < valueDescriptors.length; i++) {
            const primaryKey = i + 1
            expect(arrayResult[i].primaryKey).toBe(primaryKey)
            delete arrayResult[i].primaryKey
        }
    }

    await checkValue(getAllResult, valueDescriptors)
}

// Performs a series of put()s and verifies that get()s and getAll() match.
export async function cloningTest(
    valueDescriptors: ValueDescriptor[],
    task: { id?: string },
): Promise<void> {
    await cloningTestInternal(
        valueDescriptors,
        { useKeyGenerator: false },
        task,
    )
}

// cloningTest, with coverage for key generators.
export async function cloningTestWithKeyGenerator(
    valueDescriptors: ValueDescriptor[],
    task: { id?: string },
): Promise<void> {
    // Create separate task objects with unique IDs to avoid database naming conflicts
    const task1 = { id: (task.id || "test") + "-no-keygen-" + Date.now() }
    const task2 = {
        id: (task.id || "test") + "-keygen-" + Date.now() + "-" + Math.random(),
    }

    await cloningTestInternal(
        valueDescriptors,
        { useKeyGenerator: false },
        task1,
    )
    await cloningTestInternal(
        valueDescriptors,
        { useKeyGenerator: true },
        task2,
    )
}
