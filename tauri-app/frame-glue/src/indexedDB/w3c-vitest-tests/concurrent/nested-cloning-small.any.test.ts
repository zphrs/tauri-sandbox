import { describe, test } from "vitest"
import {
    cloningTestWithKeyGenerator,
    wrapThreshold,
} from "../resources/nested-cloning-common"

// Port of w3c test: nested-cloning-small.any.js
// Tests IndexedDB: small nested objects are cloned correctly

describe("nested-cloning-small", () => {
    test("blob with small typed array", async ({ task }) => {
        await cloningTestWithKeyGenerator(
            [
                {
                    blob: {
                        type: "blob",
                        size: wrapThreshold,
                        mimeType: "text/x-blink-01",
                        seed: 1,
                    },
                    buffer: { type: "buffer", size: 64, seed: 2 },
                },
            ],
            task,
        )
    })

    test("blob array", async ({ task }) => {
        await cloningTestWithKeyGenerator(
            [
                [
                    {
                        type: "blob",
                        size: wrapThreshold,
                        mimeType: "text/x-blink-1",
                        seed: 1,
                    },
                    {
                        type: "blob",
                        size: wrapThreshold,
                        mimeType: "text/x-blink-2",
                        seed: 2,
                    },
                    {
                        type: "blob",
                        size: wrapThreshold,
                        mimeType: "text/x-blink-3",
                        seed: 3,
                    },
                ],
            ],
            task,
        )
    })

    test("array of blobs and small typed arrays", async ({ task }) => {
        await cloningTestWithKeyGenerator(
            [
                [
                    {
                        type: "blob",
                        size: wrapThreshold,
                        mimeType: "text/x-blink-01",
                        seed: 1,
                    },
                    { type: "buffer", size: 64, seed: 2 },
                    {
                        type: "blob",
                        size: wrapThreshold,
                        mimeType: "text/x-blink-03",
                        seed: 3,
                    },
                    { type: "buffer", size: 64, seed: 4 },
                    {
                        type: "blob",
                        size: wrapThreshold,
                        mimeType: "text/x-blink-05",
                        seed: 5,
                    },
                ],
            ],
            task,
        )
    })
})
