import { type Method, handleRequests } from "../../rpcOverPorts"

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

export type GetDbInfoMethod = Method<"getDbInfo", undefined, IDBDatabaseInfo[]>
export function handleGetDbInfo(port: MessagePort, docId: string) {
    handleRequests<GetDbInfoMethod>(port, "getDbInfo", () => {
        return databases(docId)
    })
}
