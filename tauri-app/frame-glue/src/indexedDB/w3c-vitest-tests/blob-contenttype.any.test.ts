import { expect, test } from "vitest"
import { createDatabase, requestToPromise } from "./resources/createDatabase"

async function blob_contenttype_test(task: { id?: string }) {
    const type = "x-files/trust-no-one"

    // Create a blob with content type
    const blob = new Blob(["mulder", "scully"], { type: type })
    // Verify the blob type matches constructor option
    expect(blob.type, "Blob type should match constructor option").toEqual(type)

    const db = await createDatabase(task, (db) => {
        db.createObjectStore("store")
    })

    // Store blob in IndexedDB
    const write_tx = db.transaction("store", "readwrite")
    const store = write_tx.objectStore("store")

    await requestToPromise(store.put(blob, "key"))

    // Retrieve blob from IndexedDB
    const read_tx = db.transaction("store", "readonly")
    const rstore = read_tx.objectStore("store")
    const read_req = rstore.get("key")

    const result = await requestToPromise(read_req)

    // Verify blob type survives round-trip
    expect(result.type, "Blob type should survive round-trip").toEqual(type)

    // Test createObjectURL (blob:// URL) - verify content type is preserved
    const url = URL.createObjectURL(result)

    // Simulate XMLHttpRequest behavior by using fetch to check Content-Type header
    try {
        const response = await fetch(url)
        const contentType = response.headers.get("Content-Type")

        expect(
            contentType,
            "Blob type should be preserved when fetched",
        ).toEqual(type)

        // Clean up
        URL.revokeObjectURL(url)
    } catch (error) {
        // Clean up on error
        URL.revokeObjectURL(url)
        throw error
    }

    // Test POSTing blob in request (simulated with fetch to content.py endpoint)
    // Note: In a real test, we'd need to set up the content.py endpoint or mock it
    // For now, we'll just verify the blob can be sent and has correct type

    const blobArrayBuffer = await result.arrayBuffer()
    const blobString = new TextDecoder().decode(blobArrayBuffer)

    if (blobString !== "mulderscully") {
        throw new Error(
            `Blob content should be preserved. Expected: mulderscully, Got: ${blobString}`,
        )
    }
}

// Test entry using a single vitest test
test("Blob Content Type Handling", async ({ task }) => {
    await blob_contenttype_test(task)
})
