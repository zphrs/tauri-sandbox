import { describe, expect, test } from "vitest"
import { createDatabase } from "./resources/createDatabase"
import {
    NotFoundError,
    InvalidStateError,
    InvalidAccessError,
} from "../inMemoryIdb/lib/errors"

describe("IDBDatabase.transaction()", () => {
    test("Attempt to open a transaction with invalid scope", async ({
        task,
    }) => {
        const db = await createDatabase(task, () => {})
        expect(() => db.transaction("non-existing")).toThrowError(NotFoundError)
    })

    test("Opening a transaction defaults to a read-only mode", async ({
        task,
    }) => {
        const db = await createDatabase(task, (db) => {
            db.createObjectStore("readonly")
        })
        const tx = db.transaction("readonly", "readonly")
        expect(tx.mode).toBe("readonly")
    })

    test("Attempt to open a transaction from closed database connection", async ({
        task,
    }) => {
        const db = await createDatabase(task, (db) => {
            db.createObjectStore("test")
        })
        db.close()
        expect(() => db.transaction("test", "readonly")).toThrowError(
            InvalidStateError,
        )
    })

    test("Attempt to open a transaction with invalid mode", async ({
        task,
    }) => {
        const db = await createDatabase(task, (db) => {
            db.createObjectStore("test")
        })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect(() => db.transaction("test", "whatever" as any)).toThrowError(
            TypeError,
        )
    })

    test("If storeNames is an empty list, the implementation must throw a DOMException of type InvalidAccessError", async ({
        task,
    }) => {
        const db = await createDatabase(task, () => {})
        expect(() => db.transaction([])).toThrowError(InvalidAccessError)
    })
})
