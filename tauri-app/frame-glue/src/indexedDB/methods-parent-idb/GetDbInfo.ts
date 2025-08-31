import { handleRequests } from "../../rpcOverPorts"
import type { Handlers } from "../methods-scaffolding/setupIDBMethodHandlers"
import type { GetDbInfoMethod } from "../methods-scaffolding/types/"

async function databases(docId: string): Promise<IDBDatabaseInfo[]> {
    const dbs = (await indexedDB.databases())
        .filter((value) => value.name?.startsWith(`${docId}:`))
        .map((value) => {
            return {
                name: value.name?.slice(`${docId}:`.length),
                version: value.version,
            } satisfies IDBDatabaseInfo
        })
    return dbs
}
export const getDbInfoHandler: Handlers["getDbInfo"] = databases
export function handleGetDbInfo(port: MessagePort, docId: string) {
    handleRequests<GetDbInfoMethod>(
        port,
        "getDbInfo",
        databases.bind(undefined, docId),
    )
}
