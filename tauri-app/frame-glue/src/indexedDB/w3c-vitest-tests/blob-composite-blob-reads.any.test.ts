import { test } from "vitest"
import { createDatabase } from "./resources/createDatabase"

// Port of w3c test: blob-composite-blob-reads.any.js
// Validates composite blob read coherency across different read modes.

function promiseForTransaction(transaction: IDBTransaction): Promise<void> {
    return new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve()
        transaction.onabort = () => reject(new Error("transaction aborted"))
        transaction.onerror = () => reject(new Error("transaction error"))
    })
}

function make_arraybuffer_contents(index: number, size: number): ArrayBuffer {
    const arr = new Uint8Array(size)
    for (
        let i = 0, counter = 0;
        i < size;
        i += 2, counter = (counter + 3) % 256
    ) {
        arr[i] = index & 0xff
        if (i + 1 < size) arr[i + 1] = counter
    }
    return arr.buffer
}

function validate_arraybuffer_contents(
    source: string,
    buffer: ArrayBuffer | ArrayBufferLike,
    blobCount: number,
    blobSize: number,
) {
    const problems: string[] = []
    const arr = new Uint8Array(buffer as ArrayBuffer)
    const expectedLength = blobCount * blobSize
    if (arr.length !== expectedLength) {
        const actualCount = Math.floor(arr.length / blobSize)
        problems.push(
            `ArrayBuffer only holds ${actualCount} blobs' worth instead of ${blobCount}.`,
        )
        problems.push(
            `Actual ArrayBuffer is ${arr.length} bytes but expected ${expectedLength}`,
        )
    }

    const counterBlobStep = ((blobSize / 2) * 3) % 256
    let expectedBlob = 0
    let blobSeenSoFar = 0
    let expectedCounter = 0
    let counterDrift = 0
    for (let i = 0; i < arr.length; i += 2) {
        if (arr[i] !== expectedBlob || blobSeenSoFar >= blobSize) {
            if (blobSeenSoFar !== blobSize) {
                problems.push(
                    `Truncated blob ${expectedBlob} after ${blobSeenSoFar} bytes.`,
                )
            } else {
                expectedBlob++
            }
            if (expectedBlob !== arr[i]) {
                problems.push(
                    `Expected blob ${expectedBlob} but found ${arr[i]}, compensating.`,
                )
                expectedBlob = arr[i]
            }
            blobSeenSoFar = 0
            expectedCounter = (expectedBlob * counterBlobStep) % 256
            counterDrift = 0
        }

        const actualCounter = arr[i + 1]
        if (actualCounter !== (expectedCounter + counterDrift) % 256) {
            const newDrift = expectedCounter - actualCounter
            problems.push(
                `In blob ${expectedBlob} at ${
                    blobSeenSoFar + 1
                } bytes in, counter drift now ${newDrift} was ${counterDrift}`,
            )
            counterDrift = newDrift
        }

        blobSeenSoFar += 2
        expectedCounter = (expectedCounter + 3) % 256
    }

    if (problems.length) {
        throw new Error(
            `${source} blob payload problem: ${problems.join("\n")}`,
        )
    }
}

async function composite_blob_test(
    {
        blobCount,
        blobSize,
    }: { blobCount: number; blobSize: number; name: string },
    task: { id?: string },
) {
    const modes = ["fetch-blob-url", "direct"]
    for (const mode of modes) {
        // create memBlobs
        const memBlobs: Blob[] = []
        for (let iBlob = 0; iBlob < blobCount; iBlob++) {
            memBlobs.push(
                new Blob([make_arraybuffer_contents(iBlob, blobSize)]),
            )
        }

        const db = await createDatabase(task, (db) => {
            db.createObjectStore("blobs")
        })

        const key = "the-blobs"
        const write_tx = db.transaction("blobs", "readwrite")
        const store = write_tx.objectStore("blobs")
        store.put(memBlobs, key)

        await promiseForTransaction(write_tx)

        const read_tx = db.transaction("blobs", "readonly")
        const rstore = read_tx.objectStore("blobs")
        const read_req = rstore.get(key)

        await promiseForTransaction(read_tx)

        const diskBlobs = (read_req as IDBRequest<Blob[]>).result
        const compositeBlob = new Blob(diskBlobs)

        if (mode === "fetch-blob-url") {
            const blobUrl = URL.createObjectURL(compositeBlob)
            const urlResp = await fetch(blobUrl)
            const urlFetchArrayBuffer = await urlResp.arrayBuffer()
            URL.revokeObjectURL(blobUrl)
            validate_arraybuffer_contents(
                "fetched URL",
                urlFetchArrayBuffer,
                blobCount,
                blobSize,
            )
        } else if (mode === "direct") {
            const directArrayBuffer = await compositeBlob.arrayBuffer()
            validate_arraybuffer_contents(
                "arrayBuffer",
                directArrayBuffer,
                blobCount,
                blobSize,
            )
        }
    }
}

// Test entry using a single vitest test which calls the helper; keep heavy timeout in mind
test("Composite Blob Handling: Many blobs", async ({ task }) => {
    // parameters from original: blobCount:16, blobSize:256*1024
    await composite_blob_test(
        { blobCount: 16, blobSize: 256 * 1024, name: "Many blobs" },
        task,
    )
})
