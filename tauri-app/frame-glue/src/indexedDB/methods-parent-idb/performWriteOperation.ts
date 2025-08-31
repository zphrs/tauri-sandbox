import { deserializeQuery } from "../methods-scaffolding/SerializedRange"
import type { Write } from "../methods-scaffolding/types/"

export async function performWriteOperation(
    change: Write,
    store: IDBObjectStore,
) {
    switch (change.method) {
        case "add": {
            const { value, key } = change.params
            return store.add(value, key)
        }
        case "clear": {
            return store.clear()
        }
        case "delete": {
            const { query } = change.params
            const out = store.delete(deserializeQuery(query)!)
            return out
        }
        case "put": {
            const { value, key } = change.params
            return store.put(value, key)
        }
        case "replace": {
            // key stays the same so no need to update the metadata store
            const { key, index, value } = change.params
            const request = store.index(index).openCursor(key)
            return await new Promise<IDBRequest<IDBValidKey>>((res) => {
                request.onsuccess = () => {
                    res(request.result!.update(value))
                }
            })
        }
    }
}
