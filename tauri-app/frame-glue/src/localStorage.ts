import { getMessagePort, postMessagePort } from "./SetupCrossthreadedPorts"

export async function overrideLocalStorage(docId: string) {
    window.localStorage.clear()
    const port = await getMessagePort("localStorage")
    const initialStore = await new Promise<{ [key: string]: string }>((res) => {
        port.addEventListener("message", (event) => {
            const msgData = event.data
            switch (msgData.call) {
                case "init":
                    res(msgData.initialStore)
            }
        })
    })

    port.addEventListener("message", (event) => {
        const msgData = event.data
        switch (msgData.call) {
            case "storageEvent":
                initialStore[msgData.key] = msgData.newValue
                window.dispatchEvent(
                    new StorageEvent("storage", {
                        ...msgData,
                        url: `${window.origin}/${docId}`,
                        //   storageArea: ls,
                    }),
                )
        }
    })

    port.start()

    const ls = new Proxy(initialStore as Storage, {
        get(target, symbol) {
            if (symbol in target) {
                return target[symbol.toString()]
            }
            switch (symbol.toString()) {
                case "setItem":
                    return (key: string, value: string) => {
                        target[key] = value
                        port.postMessage({
                            call: "setItem",
                            key,
                            value,
                        })
                    }
                case "getItem":
                    return (key: string) => {
                        return target[key]
                    }
                case "removeItem":
                    return (key: string) => {
                        delete target[key]
                        port.postMessage({
                            call: "removeItem",
                            key,
                        })
                    }
                case "key":
                    return (n: number) => {
                        const keys = Object.keys(target)
                        if (n >= keys.length) {
                            return null
                        }
                        return keys[n]
                    }
                case "length":
                    return Object.keys(target).length
            }
        },
        set(target, symbol, newValue) {
            target[symbol.toString()] = newValue
            if (
                !["setItem", "getItem", "removeItem", "key", "length"].includes(
                    symbol.toString(),
                )
            ) {
                port.postMessage({
                    call: "setItem",
                    key: symbol.toString(),
                    value: newValue,
                })
            }
            return true
        },
        deleteProperty(target, key) {
            const out = Reflect.deleteProperty(target, key)
            window.parent.postMessage(
                {
                    call: "removeItem",
                    key,
                },
                "*",
            )
            return out
        },
    })
    Object.defineProperty(window, "localStorage", {
        value: ls,
        writable: true,
    })
    port.postMessage({
        call: "initialized",
    })
}

export async function localStorageParentSetup(docId: string, window: Window) {
    const port = await postMessagePort("localStorage", window)

    const [initialStore, db] = await new Promise<
        [
            {
                [key: string]: string
            },
            db: IDBDatabase,
        ]
    >((res, rej) => {
        const initialLocalStorage: { [key: string]: string } = {}
        const dbOpenRequest = window.indexedDB.open(`localstorage:${docId}`)
        dbOpenRequest.addEventListener("success", () => {
            const db = dbOpenRequest.result
            const tx = db.transaction(docId)
            const store = tx.objectStore("storage")
            const objStore = store.getAll()

            const objStoreKeys = store.getAllKeys()

            tx.oncomplete = () => {
                for (const [i, key] of objStoreKeys.result.entries())
                    initialLocalStorage[key.toString()] = objStore.result[i]
                res([initialLocalStorage, db])
            }
            tx.onabort = () => {
                rej("transaction aborted: " + tx.error?.toString())
            }
        })
        dbOpenRequest.addEventListener("upgradeneeded", () => {
            const db = dbOpenRequest.result
            db.createObjectStore(docId)
        })
        dbOpenRequest.addEventListener("blocked", () => {
            rej("Open request was blocked")
        })
        dbOpenRequest.addEventListener("error", () => {
            rej(dbOpenRequest.error)
        })
    })
    let childInitedRes: () => void
    const childInitialized = new Promise<void>((r) => {
        childInitedRes = r
    })
    port.onmessage = async (event) => {
        const objStore = db.transaction(docId, "readwrite").objectStore(docId)
        switch (event.data.call) {
            case "setItem":
                localStorage.setItem(
                    `localStorage:${docId}:${encodeURIComponent(
                        event.data.key,
                    )}`,
                    event.data.value,
                )
                objStore.put(event.data.value, event.data.key)
                break
            case "removeItem":
                // uri encode key so that we can safely use ":" as a deliminator
                localStorage.removeItem(
                    `localStorage:${docId}:${encodeURIComponent(
                        event.data.key,
                    )}`,
                )
                objStore.delete(event.data.key)
                break
            case "initialized":
                childInitedRes()
        }
    }
    port.postMessage({ call: "init", initialStore })
    console.log("Posted init message")
    window.addEventListener("storage", (event) => {
        if (event.key == null) {
            // clear event
            port.postMessage({
                key: null,
                oldValue: event.oldValue,
                newValue: event.newValue,
            })
            return
        }
        const [ls, dId, encodedKey] = event.key.split(":")
        if (ls != "localStorage") return
        if (dId != docId) return
        const key = decodeURIComponent(encodedKey)
        port.postMessage({
            call: "storageEvent",
            key,
            oldValue: event.oldValue,
            newValue: event.newValue,
        })
    })
    await childInitialized
}
