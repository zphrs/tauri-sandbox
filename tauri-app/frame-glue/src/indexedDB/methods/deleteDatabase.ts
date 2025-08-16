import { handleRequests, type Method } from "../../rpcOverPorts"
import { requestToPromise } from "./readFromStore"

export type DeleteDatabaseMethod = Method<
    "deleteDatabase",
    { name: string },
    null
>

export function handleDeleteDatabase(port: MessagePort, docId: string) {
    handleRequests<DeleteDatabaseMethod>(
        port,
        "deleteDatabase",
        async ({ name }) => {
            await requestToPromise(indexedDB.deleteDatabase(`${docId}:${name}`))
            return null
        }
    )
}
