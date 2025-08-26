---
mode: agent

tools: [
        "codebase",
        "problems",
        "testFailure",
        "findTestFiles",
        "runTests",
        "editFiles",
        "search",
    ]
description: "Generate the next test file in the TODO list"
---

Write the selected ${selection} test.ts file(s) listed in #file:../../src/indexedDB/w3c-vitest-tests/TODO.md (or next test after line ${input:line}) based on the original test in #file:../../src/indexedDB/w3c-tests and the previously written tests in the directory #file:../../src/indexedDB/w3c-vitest-tests/concurrent and #file:../../src/indexedDB/w3c-vitest-tests/serial , especially #file:../../src/indexedDB/w3c-vitest-tests/concurrent/idbcursor-advance.any.test.ts and #file:../../src/indexedDB/w3c-vitest-tests/concurrent/event-dispatch-active-flag.any.test.ts . Be sure to use the convenience functions exported from #file:../../src/indexedDB/w3c-vitest-tests/resources/createDatabase.ts like #sym:requestToPromise , #sym:createDatabase , #sym:createNamedDatabase , and #sym:migrateNamedDatabase .

If you need to run `expect()` the raw event object from a request, note that `expect()` calls will only work correctly at the top level. To get any object out of a request, including a raw event object, you can follow this pattern:

```js
const delReq = idb.deleteDatabase(name)
const evt = await new Promise<IDBVersionChangeEvent>(
    (resolve, reject) => {
        delReq.onerror = () =>
            reject(delReq.error)
        delReq.onsuccess = (e) => {
            const evt = e as unknown as IDBVersionChangeEvent
            resolve(evt)
        }
    },
)
```

Make sure to call #ref:cleanupDbRefAfterTest if you manually call `idb.open()` in the test.

Place the new test in #file:../../src/indexedDB/w3c-vitest-tests/concurrent if the test does not interract with other tests' databases, otherwise place the new tests in #file:../../src/indexedDB/w3c-vitest-tests/serial .

Be sure to fix all typescript and linting problems in the workspace pertaining to the new typescript file with #problems . After the test is written, check that the tests pass by running them with #runTests . If the tests passed then check off the item in the todo list with an X, otherwise skip the failing tests with `test.skip()` and mark the item with a slash (/).
