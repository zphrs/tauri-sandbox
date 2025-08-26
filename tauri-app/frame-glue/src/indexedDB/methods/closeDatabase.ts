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
            const dbRecord = openedDbs[`${docId}:${name}`]
            if (dbRecord && --dbRecord.count === 0) {
                dbRecord.db.close()
                delete openedDbs[`${docId}:${name}`]
            }
            return null
        },
    )
}
