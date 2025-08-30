import { describe, test } from "vitest"
import {
    cloningTest,
    cloningTestWithKeyGenerator,
    wrapThreshold,
} from "../resources/nested-cloning-common"

// Port of w3c test: nested-cloning-large.any.js
// Tests IndexedDB: large nested objects are cloned correctly

describe("nested-cloning-large", () => {
    test("large typed array", async ({ task }) => {
        await cloningTest(
            [
                { type: "buffer", size: wrapThreshold, seed: 1 },
                // This test uses non-random data to test that compression doesn't
                // break functionality.
                { type: "buffer", size: wrapThreshold, seed: 0 },
            ],
            task,
        )
    })

    test("blob with large typed array", async ({ task }) => {
        await cloningTestWithKeyGenerator(
            [
                {
                    blob: {
                        type: "blob",
                        size: wrapThreshold,
                        mimeType: "text/x-blink-01",
                        seed: 1,
                    },
                    buffer: { type: "buffer", size: wrapThreshold, seed: 2 },
                },
            ],
            task,
        )
    })

    test("array of blobs and large typed arrays", async ({ task }) => {
        await cloningTestWithKeyGenerator(
            [
                [
                    {
                        type: "blob",
                        size: wrapThreshold,
                        mimeType: "text/x-blink-01",
                        seed: 1,
                    },
                    { type: "buffer", size: wrapThreshold, seed: 2 },
                    {
                        type: "blob",
                        size: wrapThreshold,
                        mimeType: "text/x-blink-03",
                        seed: 3,
                    },
                    { type: "buffer", size: wrapThreshold, seed: 4 },
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

    test("object with blobs and large typed arrays", async ({ task }) => {
        await cloningTestWithKeyGenerator(
            [
                {
                    blob: {
                        type: "blob",
                        size: wrapThreshold,
                        mimeType: "text/x-blink1",
                        seed: 1,
                    },
                    more: [
                        { type: "buffer", size: wrapThreshold, seed: 2 },
                        {
                            type: "blob",
                            size: wrapThreshold,
                            mimeType: "text/x-blink3",
                            seed: 3,
                        },
                        { type: "buffer", size: wrapThreshold, seed: 4 },
                    ],
                    blob2: {
                        type: "blob",
                        size: wrapThreshold,
                        mimeType: "text/x-blink5",
                        seed: 5,
                    },
                },
            ],
            task,
        )
    })
})
