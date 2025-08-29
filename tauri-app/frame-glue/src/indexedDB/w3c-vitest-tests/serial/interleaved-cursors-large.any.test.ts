import { describe, test } from "vitest"
import { cursorTest } from "../resources/interleaved-cursors-common"

// Port of w3c test: interleaved-cursors-large.any.js
// Tests interleaved iteration of multiple cursors with large datasets

describe("Interleaved cursors (large dataset)", () => {
    test(
        "250 cursors",
        async () => {
            await cursorTest(250, "large")
        },
        { timeout: 60000 },
    ) // Increased timeout for large dataset
})
