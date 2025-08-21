import { test, expect } from "vitest"
import { createDatabase } from "./resources/createDatabase"

// Port of w3c test: idb-explicit-commit-throw.any.js
// Ensures that errors thrown after an explicit commit don't prevent the transaction from being committed.

function promiseForTransaction(transaction: IDBTransaction): Promise<void> {
    return new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve()
        transaction.onabort = () => reject(new Error("transaction aborted"))
        transaction.onerror = () => reject(new Error("transaction error"))
    })
}

// Helper function to create a 'books' object store like in the original W3C test
function createBooksStore(db: IDBDatabase) {
    const store = db.createObjectStore("books", {
        keyPath: "isbn",
        autoIncrement: true,
    })
    store.createIndex("by_author", "author")
    store.createIndex("by_title", "title", { unique: true })
    return store
}

test("Any errors in callbacks that run after an explicit commit will not stop the commit from being processed", async ({
    task,
}) => {
    const db = await createDatabase(task, (db) => {
        createBooksStore(db)
    })

    // Track what happens
    let successCalled = false
    let errorThrown = false

    const txn = db.transaction(["books"], "readwrite")
    const objectStore = txn.objectStore("books")
    const putRequest = objectStore.put({ isbn: "one", title: "title" })

    // Explicitly commit the transaction BEFORE setting up the error handler
    txn.commit()

    // Set up success handler that will throw after commit is called
    putRequest.onsuccess = () => {
        successCalled = true
        errorThrown = true
        // This error should be thrown but not affect the commit
        throw new Error(
            "This error thrown after an explicit commit should not prevent the transaction from committing.",
        )
    }

    // The transaction should still complete despite the error
    let transactionCompleted = false
    try {
        await promiseForTransaction(txn)
        transactionCompleted = true
    } catch {
        // If the transaction rejects due to the thrown error, that's not correct
        // The commit should still succeed
    }

    // The transaction should have completed successfully
    expect(transactionCompleted).toBe(true)
    expect(successCalled).toBe(true)
    expect(errorThrown).toBe(true)

    // Verify that the data was committed despite the error
    const txn2 = db.transaction(["books"], "readonly")
    const objectStore2 = txn2.objectStore("books")
    const getRequest = objectStore2.get("one")

    await promiseForTransaction(txn2)

    expect(getRequest.result).toBeTruthy()
    expect(getRequest.result.title).toBe("title")
})
