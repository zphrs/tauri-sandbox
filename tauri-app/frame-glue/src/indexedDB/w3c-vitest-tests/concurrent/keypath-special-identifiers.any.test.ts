import { describe, expect, test } from "vitest"
import { createDatabase, requestToPromise } from "../resources/createDatabase"

// Port of w3c test: keypath-special-identifiers.any.js
// Tests special-cased identifiers in extracting keys from values (ES bindings)

describe("keypath-special-identifiers", () => {
    const testCases: Array<{
        type: string
        property: string
        instance: string | string[] | Blob | File
        skip?: boolean
    }> = [
        {
            type: "String",
            property: "length",
            instance: "abc",
        },
        {
            type: "Array",
            property: "length",
            instance: ["a", "b", "c"],
        },
        {
            type: "Blob",
            property: "size",
            instance: new Blob(["abc"]),
        },
        {
            type: "Blob",
            property: "type",
            instance: new Blob([""], { type: "foo/bar" }),
        },
        {
            type: "File",
            property: "name",
            instance: new File([""], "foo"),
        },
        {
            type: "File",
            property: "lastModified",
            instance: new File([""], "", { lastModified: 123 }),
        },
    ]

    testCases.forEach((testcase) => {
        
        test(
            `Type: ${testcase.type}, identifier: ${testcase.property}`,
            async ({ task }) => {
                const db = await createDatabase(task, (db) => {
                    db.createObjectStore("store", {
                        autoIncrement: true,
                        keyPath: testcase.property,
                    })
                })

                const key = (
                    testcase.instance as unknown as Record<string, unknown>
                )[testcase.property]
                const tx = db.transaction("store", "readwrite")

                const putRequest = tx
                    .objectStore("store")
                    .put(testcase.instance)
                await requestToPromise(putRequest)

                const getRequest = tx
                    .objectStore("store")
                    .get(key as IDBValidKey)
                const result = await requestToPromise(getRequest)

                expect(
                    (result as unknown as Record<string, unknown>)[
                        testcase.property
                    ],
                ).toEqual(key)

                await new Promise<void>((resolve, reject) => {
                    tx.oncomplete = () => resolve()
                    tx.onerror = () => reject(tx.error)
                })
            },
        )
    })
})
