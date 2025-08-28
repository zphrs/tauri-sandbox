import { describe, test, expect } from "vitest"
import { createDatabase } from "../resources/createDatabase"

// Port of w3c test: idbtransaction_objectStoreNames.any.js
// Tests IDBTransaction.objectStoreNames attribute

describe("IDBTransaction.objectStoreNames", () => {
    test("during upgrade transaction", async ({ task }) => {
        const db = await createDatabase(task, (database, tx) => {
            expect(Array.from(tx.objectStoreNames)).toEqual([])
            expect(Array.from(database.objectStoreNames)).toEqual(
                Array.from(tx.objectStoreNames),
            )

            database.createObjectStore("s1")
            expect(Array.from(tx.objectStoreNames)).toEqual(["s1"])
            expect(Array.from(database.objectStoreNames)).toEqual(
                Array.from(tx.objectStoreNames),
            )

            database.createObjectStore("s3")
            expect(Array.from(tx.objectStoreNames)).toEqual(["s1", "s3"])
            expect(Array.from(database.objectStoreNames)).toEqual(
                Array.from(tx.objectStoreNames),
            )

            database.createObjectStore("s2")
            expect(Array.from(tx.objectStoreNames)).toEqual(["s1", "s2", "s3"])
            expect(Array.from(database.objectStoreNames)).toEqual(
                Array.from(tx.objectStoreNames),
            )

            database.deleteObjectStore("s1")
            expect(Array.from(tx.objectStoreNames)).toEqual(["s2", "s3"])
            expect(Array.from(database.objectStoreNames)).toEqual(
                Array.from(tx.objectStoreNames),
            )
        })

        db.close()
    })

    test("transaction scope", async ({ task }) => {
        const db = await createDatabase(task, (database) => {
            database.createObjectStore("s1")
            database.createObjectStore("s2")
        })

        expect(
            Array.from(db.transaction("s1", "readonly").objectStoreNames),
        ).toEqual(["s1"])
        expect(
            Array.from(db.transaction(["s1", "s2"]).objectStoreNames),
        ).toEqual(["s1", "s2"])

        db.close()
    })

    test("value after commit", { timeout: 2000 }, async ({ task }) => {
        const db = await createDatabase(task, (database) => {
            database.createObjectStore("s1")
            database.createObjectStore("s2")
        })

        await new Promise<void>((resolve, reject) => {
            const tx = db.transaction(["s1", "s2"], "readwrite")
            tx.objectStore("s1").put(1, 1)
            tx.oncomplete = () => {
                expect(Array.from(tx.objectStoreNames)).toEqual(["s1", "s2"])
                resolve()
            }
            tx.onerror = (e) => {
                reject((e.target as IDBTransaction).error)
            }
            tx.onabort = () => {
                reject("Aborted")
            }
        })
    })

    test("value after abort", async ({ task }) => {
        const db = await createDatabase(task, (database) => {
            database.createObjectStore("s1")
            database.createObjectStore("s2")
        })

        await new Promise<void>((resolve) => {
            const tx = db.transaction(["s1", "s2"], "readwrite")
            tx.objectStore("s1").put(0, 0)
            tx.objectStore("s1").add(0, 0) // This should cause abort due to constraint
            tx.onabort = () => {
                expect(Array.from(tx.objectStoreNames)).toEqual(["s1", "s2"])
                resolve()
            }
        })

        db.close()
    })

    test("sorting", async ({ task }) => {
        const db = await createDatabase(task, (database) => {
            database.createObjectStore("s1")
            database.createObjectStore("s2")
            database.createObjectStore("s3")
        })

        expect(
            Array.from(db.transaction(["s3", "s2", "s1"]).objectStoreNames),
        ).toEqual(["s1", "s2", "s3"])

        db.close()
    })

    test("no duplicates", async ({ task }) => {
        const db = await createDatabase(task, (database) => {
            database.createObjectStore("s1")
            database.createObjectStore("s2")
        })

        expect(
            Array.from(db.transaction(["s2", "s1", "s2"]).objectStoreNames),
        ).toEqual(["s1", "s2"])

        db.close()
    })

    test("unusual names", async ({ task }) => {
        const unusualNames = [
            "", // empty string
            "\x00", // U+0000 NULL
            "\xFF", // U+00FF LATIN SMALL LETTER Y WITH DIAERESIS
            "1", // basic ASCII
            "12", // basic ASCII
            "123", // basic ASCII
            "abc", // basic ASCII
            "ABC", // basic ASCII
            "\xA2", // U+00A2 CENT SIGN
            "\u6C34", // U+6C34 CJK UNIFIED IDEOGRAPH (water)
            "\uD834\uDD1E", // U+1D11E MUSICAL SYMBOL G-CLEF (UTF-16 surrogate pair)
            "\uFFFD", // U+FFFD REPLACEMENT CHARACTER
            "\uD800", // UTF-16 surrogate lead
            "\uDC00", // UTF-16 surrogate trail
        ].sort()

        const db = await createDatabase(task, (database, tx) => {
            ;[...unusualNames].reverse().forEach((name) => {
                database.createObjectStore(name)
            })
            expect(Array.from(tx.objectStoreNames)).toEqual(unusualNames)
        })

        const tx = db.transaction(
            [...unusualNames].reverse().concat(unusualNames),
        )
        expect(Array.from(tx.objectStoreNames)).toEqual(unusualNames)

        db.close()
    })
})
