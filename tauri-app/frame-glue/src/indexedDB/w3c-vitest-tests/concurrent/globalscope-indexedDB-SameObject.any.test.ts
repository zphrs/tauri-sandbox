import { describe, expect, test } from "vitest"
import { idb } from "../resources/createDatabase"

// Port of w3c test: globalscope-indexedDB-SameObject.any.js
// META: title=IndexedDB: Verify [SameObject] behavior of the global scope's indexedDB attribute
describe("globalscope-indexedDB-SameObject", () => {
    test("indexedDB is [SameObject]", () => {
        expect(idb).toBe(idb)
        expect(idb === idb).toBe(true)
    })
})
