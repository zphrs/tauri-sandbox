import { describe, expect, test } from "vitest"
import { createDatabase } from "../resources/createDatabase"
import { InvalidStateError, NotFoundError } from "../../inMemoryIdb/lib/errors"

// Port of w3c test: idbdatabase-transaction-exception-order.any.js
// Tests IDBDatabase.transaction() exception ordering

describe("IDBDatabase.transaction exception order", () => {
    test("InvalidStateError vs. NotFoundError", async ({ task }) => {
        const db = await createDatabase(task, (database) => {
            database.createObjectStore("s")
        })

        db.close()

        expect(() => db.transaction("no-such-store")).toThrow(InvalidStateError)
    })

    test("InvalidStateError vs. InvalidAccessError", async ({ task }) => {
        const db = await createDatabase(task, (database) => {
            database.createObjectStore("s")
        })

        db.close()

        expect(() => db.transaction([])).toThrow(InvalidStateError)
    })

    test("IDBDatabase.transaction throws exception on invalid mode", async ({
        task,
    }) => {
        const db = await createDatabase(task, (database) => {
            database.createObjectStore("s")
        })

        expect(() =>
            db.transaction("s", "versionchange" as IDBTransactionMode),
        ).toThrowError(TypeError)
    })

    test("NotFoundError vs. TypeError", async ({ task }) => {
        const db = await createDatabase(task, (database) => {
            database.createObjectStore("s")
        })

        expect(() =>
            db.transaction(
                "no-such-store",
                "versionchange" as IDBTransactionMode,
            ),
        ).toThrow(NotFoundError)
    })
})
