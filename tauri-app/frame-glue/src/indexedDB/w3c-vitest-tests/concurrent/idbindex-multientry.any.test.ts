import { describe, test, expect } from "vitest"
import { createDatabase, requestToPromise } from "../resources/createDatabase"
import { InvalidAccessError } from "../../inMemoryIdb/lib/errors"

// Port of w3c test: idbindex-multientry.any.js
// Tests IDBIndex.multiEntry

describe("IDBIndex.multiEntry", () => {
    test("Array keyPath with multiEntry", async ({ task }) => {
        let err: unknown | undefined = undefined
        await createDatabase(task, (db) => {
            const store = db.createObjectStore("store")
            try {
                store.createIndex("actors", ["name"], { multiEntry: true })
                expect.unreachable()
            } catch (e) {
                err = e
            }
        })
        expect(err).instanceOf(InvalidAccessError)
    })

    test(
        "A 1000 entry multiEntry array",
        { timeout: 10000 },
        async ({ task }) => {
            const db = await createDatabase(task, (db) => {
                const store = db.createObjectStore("store")
                store.createIndex("index", "idxkeys", { multiEntry: true })
            })

            const obj: { test: string; idxkeys: string[] } = {
                test: "yo",
                idxkeys: [],
            }
            for (let i = 0; i < 1000; i++) {
                obj.idxkeys.push(`index_no_${i}`)
            }

            const tx = db.transaction("store", "readwrite")
            const store = tx.objectStore("store")
            const key = await requestToPromise(store.put(obj, 1))
            expect(key).toBe(1)
            await new Promise((resolve, reject) => {
                tx.oncomplete = () => resolve(undefined)
                tx.onerror = () => reject(tx.error)
            })

            const tx2 = db.transaction("store", "readonly")
            const idx = tx2.objectStore("store").index("index")
            type Entry = { test: string; idxkeys: string[] }
            for (let i = 0; i < 1000; i++) {
                const result = await requestToPromise<Entry>(
                    idx.get(`index_no_${i}`),
                )
                expect(result.test).toBe("yo")
            }
            const last = await requestToPromise<Entry>(idx.get("index_no_999"))
            expect(last.test).toBe("yo")
            expect(last.idxkeys.length).toBe(1000)
            await new Promise((resolve, reject) => {
                tx2.oncomplete = () => resolve(undefined)
                tx2.onerror = () => reject(tx2.error)
            })
        },
    )

    test("Adding keys", async ({ task }) => {
        const db = await createDatabase(task, (db) => {
            const store = db.createObjectStore("store")
            store.createIndex("actors", "name", { multiEntry: true })
            store.add({ name: "Odin" }, 1)
            store.add({ name: ["Rita", "Scheeta", { Bobby: "Bobby" }] }, 2)
            store.add({ name: [{ s: "Robert" }, "Neil", "Bobby"] }, 3)
        })

        const tx = db.transaction("store", "readonly")
        const idx = tx.objectStore("store").index("actors")
        const names = ["Odin", "Rita", "Scheeta", "Neil", "Bobby"]
        const gotten: IDBValidKey[] = []
        for (const name of names) {
            const key = await requestToPromise(idx.getKey(name))
            gotten.push(key!)
        }
        expect(gotten).toEqual([1, 2, 2, 3, 3])
        await new Promise((resolve, reject) => {
            tx.oncomplete = () => resolve(undefined)
            tx.onerror = () => reject(tx.error)
        })
    })
})
