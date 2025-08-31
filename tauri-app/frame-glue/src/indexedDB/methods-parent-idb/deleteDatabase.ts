import { handleRequests, type Method } from "../../rpcOverPorts"
import type { Handlers } from "../methods-scaffolding/setupIDBMethodHandlers"
import { requestToPromise } from "./readFromStore"

export type DeleteDatabaseMethod = Method<
    "deleteDatabase",
    { name: string },
    null
>

export const deleteDatabaseHandler: Handlers["deleteDatabase"] = async (
    docId,
    { name },
) => {
    await requestToPromise(indexedDB.deleteDatabase(`${docId}:${name}`))
    return null
}

export function handleDeleteDatabase(port: MessagePort, docId: string) {
    handleRequests<DeleteDatabaseMethod>(
        port,
        "deleteDatabase",
        deleteDatabaseHandler.bind(undefined, docId),
    )
}
