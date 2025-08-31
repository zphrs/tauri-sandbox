import { describe, expect, test } from "vitest"
import { cleanupDbRefAfterTest, idb } from "../resources/createDatabase"
import { DataError } from "../../inMemoryIdb/lib/errors"

// Port of w3c test: key_invalid.any.js
// Tests invalid key types

describe("key_invalid", () => {
    const invalidKeyTest = (desc: string, key: unknown) => {
        test(`Invalid key - ${desc}`, async () => {
            const dbName = `testdb-${Date.now()}-${Math.random()}`
            let objStore: IDBObjectStore | null = null
            let objStore2: IDBObjectStore | null = null

            const isCloneable = (o: unknown): boolean => {
                try {
                    globalThis.postMessage(o, "*")
                    return true
                } catch {
                    return false
                }
            }

            const request = idb.open(dbName, 1)
            await new Promise<void>((resolve, reject) => {
                request.onupgradeneeded = () => {
                    try {
                        const db = request.result
                        objStore = objStore || db.createObjectStore("store")
                        // try {
                        //     objStore!.add("value", key as IDBValidKey)
                        //     expect.unreachable()
                        // } catch (e) {
                        //     expect(e).toBeInstanceOf(DataError)
                        // }
                        expect(() => {
                            objStore!.add("value", key as IDBValidKey)
                        }).toThrow(DataError)

                        if (isCloneable(key)) {
                            objStore2 =
                                objStore2 ||
                                db.createObjectStore("store2", {
                                    keyPath: ["x", "keypath"],
                                })
                            expect(() => {
                                objStore2!.add("value", key as IDBValidKey)
                            }).toThrow(DataError)
                        }
                        // resolve()
                    } catch (error) {
                        reject(error)
                    }
                }
                request.onerror = () => {
                    reject(request.error)
                }
                request.onsuccess = () => resolve()
            })

            const db = request.result
            cleanupDbRefAfterTest(db)
        })
    }

    const fakeArray = {
        length: 0,
        constructor: Array,
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ArrayClone = function () {} as any
    ArrayClone.prototype = Array
    const ArrayCloneInstance = new ArrayClone()

    // booleans
    invalidKeyTest("true", true)
    invalidKeyTest("false", false)

    // null/NaN/undefined
    invalidKeyTest("null", null)
    invalidKeyTest("NaN", NaN)
    invalidKeyTest("undefined", undefined)
    invalidKeyTest("undefined2", undefined)

    // functions
    invalidKeyTest("function() {}", function () {})

    // objects
    invalidKeyTest("{}", {})
    invalidKeyTest("{ obj: 1 }", { obj: 1 })
    invalidKeyTest("Math", Math)
    invalidKeyTest("globalThis", globalThis)
    invalidKeyTest("{length:0,constructor:Array}", fakeArray)
    invalidKeyTest("Array clone's instance", ArrayCloneInstance)
    invalidKeyTest("Array (object)", Array)
    invalidKeyTest("String (object)", String)
    invalidKeyTest("new String()", new String())
    invalidKeyTest("new Number()", new Number())
    invalidKeyTest("new Boolean()", new Boolean())

    // arrays
    invalidKeyTest("[{}]", [{}])
    invalidKeyTest("[[], [], [], [[ Date ]]]", [[], [], [], [[Date]]])
    invalidKeyTest("[undefined]", [undefined])
    invalidKeyTest("[,1]", [undefined, 1])

    // dates
    invalidKeyTest("new Date(NaN)", new Date(NaN))
    invalidKeyTest("new Date(Infinity)", new Date(Infinity))

    // regexes
    invalidKeyTest("/foo/", /foo/)
    invalidKeyTest("new RegExp()", new RegExp(""))

    const sparse: unknown[] = []
    sparse[10] = "hei"
    invalidKeyTest("sparse array", sparse)

    const sparse2: unknown[] = []
    sparse2[0] = 1
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(sparse2 as any)[""] = 2
    sparse2[2] = 3
    invalidKeyTest("sparse array 2", sparse2)

    invalidKeyTest("[[1], [3], [7], [[ sparse array ]]]", [
        [1],
        [3],
        [7],
        [[sparse2]],
    ])

    // sparse3 - arrays with holes
    const sparse3: (number | undefined)[] = [1, 2, 3]
    sparse3[4] = undefined // create a hole at index 3
    invalidKeyTest("[1,2,3,,]", sparse3)

    const recursive: unknown[] = []
    recursive.push(recursive)
    invalidKeyTest("array directly contains self", recursive)

    const recursive2: unknown[] = []
    recursive2.push([recursive2])
    invalidKeyTest("array indirectly contains self", recursive2)

    const recursive3 = [recursive]
    invalidKeyTest("array member contains self", recursive3)
    // CANNOT detect whether an object is in fact a proxy or not
    // within the normal js environment
    // invalidKeyTest("proxy of an array", new Proxy([1, 2, 3], {}))
})
