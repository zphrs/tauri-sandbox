import { describe, expect, test } from "vitest"
import { createDatabase, requestToPromise } from "../resources/createDatabase"

// Port of w3c test: idbcursor_iterating.any.js
// Tests IDBCursor iteration with concurrent modifications

describe("IDBCursor iteration", () => {
    test(
        "Iterate and Delete elements",
        { timeout: 10000 },
        async ({ task }) => {
            let count = 0

            const db = await createDatabase(task, (db) => {
                const objStore = db.createObjectStore("test", {
                    keyPath: "key",
                })

                // Add initial records 0-499
                for (let i = 0; i < 500; i++) {
                    objStore.add({ key: i, val: "val_" + i })
                }

                // Add record 500
                const rq = objStore.add({ key: 500, val: "val_500" })

                // Add records 999-501 in reverse order (after 500 is added)
                rq.onsuccess = () => {
                    for (let i = 999; i > 500; i--) {
                        objStore.add({ key: i, val: "val_" + i })
                    }
                }

                objStore.createIndex("index", ["key", "val"])
            })

            const cursor_rq = db
                .transaction("test", "readwrite")
                .objectStore("test")
                .openCursor()

            let cursor = await requestToPromise(cursor_rq)
            const store = cursor_rq.source as IDBObjectStore
            while (cursor) {
                const key = cursor.key as number

                switch (key) {
                    case 10:
                        expect(count).toBe(key)
                        await requestToPromise(store.delete(11))
                        break

                    // Delete the next key
                    case 510:
                        await requestToPromise(store.delete(511))
                        break

                    // Delete randomly
                    case 512:
                        await requestToPromise(store.delete(611))
                        await requestToPromise(store.delete(499))
                        await requestToPromise(store.delete(500))
                        break

                    case 12:
                    case 499:
                    case 500:
                    case 501:
                        expect(count).toBe(key - 1)
                        break
                    case 11:
                    case 511:
                    case 611:
                        expect.unreachable()
                        break

                    case 610:
                    case 550:
                    case 513:
                        expect(count).toBe(key - 2)
                        break

                    case 612:
                    case 999:
                        expect(count).toBe(key - 3)
                        break

                    // Delete and add a new key
                    case 520:
                        await requestToPromise(store.delete(521))
                        await requestToPromise(
                            store.add({ key: 521, val: "new" }),
                        )
                        break

                    case 521:
                        expect(cursor.value.val).toBe("new")
                        break

                    // Update the current record
                    case 530: {
                        expect(cursor.value.val).toBe("val_530")
                        await requestToPromise(
                            cursor.update({ key: 530, val: "val_531" }),
                        )

                        const getReq = store.get(530)
                        const result = await requestToPromise(getReq)
                        expect(result.val).toBe("val_531")
                        break
                    }
                }

                cursor.continue()
                count++
                cursor = await requestToPromise(cursor_rq)
            }
            // 1000 - 3
            expect(count).toBe(997)

            // Final count should be 995 (original 1000 minus 5 deletions)
            const countReq = store.count()
            const finalCount = await requestToPromise(countReq)
            expect(finalCount).toBe(995)
        },
    )
})
