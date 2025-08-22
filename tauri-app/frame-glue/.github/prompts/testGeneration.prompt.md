---
mode: agent
model: Claude Sonnet 4
tools: [
        "codebase",
        "problems",
        "testFailure",
        "findTestFiles",
        "runTests",
        "editFiles",
    ]
description: "Generate the next test file in the TODO list"
---

Write the next test.ts file listed in #file:../../src/indexedDB/w3c-vitest-tests/TODO.md based on the tests in the directory #file:../../src/indexedDB/w3c-vitest-tests , especially #file:../../src/indexedDB/w3c-vitest-tests/idbcursor-advance.any.test.ts and #file:../../src/indexedDB/w3c-vitest-tests/event-dispatch-active-flag.any.test.ts . Be sure to use the convenience functions exported from #file:../../src/indexedDB/w3c-vitest-tests/resources/createDatabase.ts like #sym:requestToPromise and #sym:createDatabase .

Be sure to fix all typescript and linting problems in the workspace pertaining to the new typescript file. After the tst is finished, check that the tests pass by running them. Check off the item in the todo list with an X if the tests passed or with a slash (/) if the tests did not.
