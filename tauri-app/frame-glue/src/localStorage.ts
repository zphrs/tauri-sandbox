export async function overrideLocalStorage(docId: string) {
    window.localStorage.clear()
    const {
        port,
        initialStore,
    }: { port: MessagePort; initialStore: { [key: string]: string } } =
        await new Promise((res) => {
            window.addEventListener("message", (ev) => {
                if (ev.data != "localStorageInit") return
                const port = ev.ports[0]
                console.log("port")
                port.addEventListener("message", (event) => {
                    const msgData = event.data
                    switch (msgData.call) {
                        case "storageEvent":
                            initialStore[msgData.key] = msgData.newValue
                            window.dispatchEvent(
                                new StorageEvent("storage", {
                                    ...msgData,
                                    url: `${origin}/${docId}`,
                                    //   storageArea: ls,
                                }),
                            )
                            break
                        case "init":
                            res({ port, initialStore: msgData.initialStore })
                    }
                })
                port.start()
            })
            console.log("added msg event listener")
        })
    console.log("Got ls init")
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

export async function localStorageParentSetup(
    docId: string,
    iframe: HTMLIFrameElement,
) {
    const { port1: port, port2: childPort } = new MessageChannel()
    if (iframe.contentWindow) {
        iframe.contentWindow.postMessage("localStorageInit", "*", [childPort])
    } else {
        iframe.addEventListener("load", () => {
            iframe.contentWindow?.postMessage("localStorageInit", "*", [
                childPort,
            ])
        })
    }
    const [initialStore, db] = await new Promise<
        [
            {
                [key: string]: string
            },
            db: IDBDatabase,
        ]
    >((res, rej) => {
        const initialLocalStorage: { [key: string]: string } = {}
        const DBOpenRequest = window.indexedDB.open(docId)
        DBOpenRequest.addEventListener("success", () => {
            const db = DBOpenRequest.result
            const objStore = db.transaction(docId).objectStore(docId)
            objStore.openCursor().onsuccess = function () {
                const cursor = this.result
                if (!cursor) {
                    res([initialLocalStorage, db])
                    return
                }

                initialLocalStorage[cursor.key.toString()] = cursor.value
                cursor.continue()
            }
        })
        DBOpenRequest.addEventListener("upgradeneeded", () => {
            const db = DBOpenRequest.result
            db.createObjectStore(docId)
        })
        DBOpenRequest.addEventListener("blocked", () => {
            rej("Open request was blocked")
        })
        DBOpenRequest.addEventListener("error", () => {
            rej(DBOpenRequest.error)
        })
    })
    let res: () => void
    const childInitialized = new Promise<void>((r) => {
        res = r
    })
    port.onmessage = async (event) => {
        const objStore = db.transaction(docId, "readwrite").objectStore(docId)
        switch (event.data.call) {
            case "setItem":
                localStorage.setItem(
                    `localStorage:${docId}:${encodeURIComponent(event.data.key)}`,
                    event.data.value,
                )
                objStore.put(event.data.value, event.data.key)
                break
            case "removeItem":
                // uri encode key so that we can safely use ":" as a deliminator
                localStorage.removeItem(
                    `localStorage:${docId}:${encodeURIComponent(event.data.key)}`,
                )
                objStore.delete(event.data.key)
                break
            case "initialized":
                res()
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
