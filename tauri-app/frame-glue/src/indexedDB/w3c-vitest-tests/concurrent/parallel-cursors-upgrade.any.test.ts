import { describe, expect, test } from "vitest"
import { createDatabase } from "../resources/createDatabase"

// Port of w3c test: parallel-cursors-upgrade.any.js
// Tests parallel iteration of cursors in upgradeneeded

describe("Parallel iteration of cursors in upgradeneeded", () => {
    const cursorCounts = [2, 20, 200, 2000]

    for (const cursorCount of cursorCounts) {
        test.concurrent(
            `${cursorCount} cursors`,
            {
                timeout: cursorCount >= 200 ? 5000 : 1000, // 5 second timeout for larger tests
            },
            async ({ task }) => {
                const db = await createDatabase(task, (database) => {
                    const store = database.createObjectStore("cache", {
                        keyPath: "key",
                    })
                    store.put({ key: "42" })

                    const promises: Promise<void>[] = []

                    for (let j = 0; j < 2; j += 1) {
                        const promise = new Promise<void>((resolve, reject) => {
                            let request: IDBRequest<IDBCursorWithValue | null>
                            for (let i = 0; i < cursorCount / 2; i += 1) {
                                request = store.openCursor()
                            }

                            let continued = false
                            request!.onsuccess = () => {
                                const cursor = request!.result

                                if (!continued) {
                                    expect(cursor).not.toBeNull()
                                    expect(cursor!.key).toBe("42")
                                    expect(cursor!.value.key).toBe("42")
                                    continued = true
                                    cursor!.continue()
                                } else {
                                    expect(cursor).toBeNull()
                                    resolve()
                                }
                            }
                            request!.onerror = () => reject(request!.error)
                        })
                        promises.push(promise)
                    }

                    return Promise.all(promises)
                })

                db.close()
            },
        )
    }
})
