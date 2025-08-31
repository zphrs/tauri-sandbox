import { handleRequests, type Method } from "../../rpcOverPorts"
import type { Handlers } from "../methods-scaffolding/setupIDBMethodHandlers"
import { openedDbs } from "./OpenDatabase"

export type CloseDatabaseMethod = Method<
    "closeDatabase",
    { name: string },
    null
>

export const closeDatabaseHandler: Handlers["closeDatabase"] = async (
    docId,
    { name },
) => {
    const dbRecord = openedDbs[`${docId}:${name}`]
    if (dbRecord && --dbRecord.count === 0) {
        dbRecord.db.close()
        delete openedDbs[`${docId}:${name}`]
    }
    return null
}

export default function handleCloseDatabase(port: MessagePort, docId: string) {
    handleRequests<CloseDatabaseMethod>(
        port,
        "closeDatabase",
        closeDatabaseHandler.bind(undefined, docId),
    )
}
