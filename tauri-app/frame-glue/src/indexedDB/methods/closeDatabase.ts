import { handleRequests, type Method } from "../../rpcOverPorts"
import { openedDbs } from "./OpenIDBDatabase"

export type CloseDatabaseMethod = Method<
    "closeDatabase",
    { name: string },
    null
>

export function handleCloseDatabase(port: MessagePort, docId: string) {
    handleRequests<CloseDatabaseMethod>(
        port,
        "closeDatabase",
        async ({ name }) => {
            const db = openedDbs[`${docId}:${name}`]
            delete openedDbs[`${docId}:${name}`]
            if (db) {
                db.close()
            }
            return null
        },
    )
}
