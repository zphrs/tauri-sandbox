export declare const wrapThreshold: number;
export declare function largeValue(size: number, seed: number): Uint8Array;
export interface BlobDescriptor {
    type: "blob";
    size: number;
    mimeType: string;
    seed: number;
}
export interface BufferDescriptor {
    type: "buffer";
    size: number;
    seed: number;
}
export type ValueDescriptor = BlobDescriptor | BufferDescriptor | Record<string, unknown> | unknown[] | string | number | boolean | null;
export declare function createValue(descriptor: ValueDescriptor): unknown;
export declare function checkValue(value: unknown, descriptor: ValueDescriptor): Promise<void>;
export declare function cloningTest(valueDescriptors: ValueDescriptor[], task: {
    id?: string;
}): Promise<void>;
export declare function cloningTestWithKeyGenerator(valueDescriptors: ValueDescriptor[], task: {
    id?: string;
}): Promise<void>;
