import { describe, test } from "vitest"
import { cursorTest } from "../resources/interleaved-cursors-common"

// Port of w3c test: interleaved-cursors-small.any.js
// Tests interleaved iteration of multiple cursors with small datasets

describe("Interleaved cursors (small datasets)", () => {
    test("1 cursor", async () => {
        await cursorTest(1, "small")
    })

    test("10 cursors", async () => {
        await cursorTest(10, "small")
    })

    test("100 cursors", async () => {
        await cursorTest(100, "small")
    })
})
