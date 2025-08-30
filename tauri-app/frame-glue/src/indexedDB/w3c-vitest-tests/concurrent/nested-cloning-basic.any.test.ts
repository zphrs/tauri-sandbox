import { describe, test } from "vitest"
import { cloningTest, wrapThreshold } from "../resources/nested-cloning-common"

// Port of w3c test: nested-cloning-basic.any.js
// Tests IndexedDB: basic objects are cloned correctly

describe("nested-cloning-basic", () => {
    test("small typed array", async ({ task }) => {
        await cloningTest([{ type: "buffer", size: 64, seed: 1 }], task)
    })

    test("blob", async ({ task }) => {
        await cloningTest(
            [
                {
                    type: "blob",
                    size: wrapThreshold,
                    mimeType: "text/x-blink-1",
                    seed: 1,
                },
            ],
            task,
        )
    })
})
