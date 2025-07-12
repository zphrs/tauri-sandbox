import { SUBDOMAIN_WILDCARD_URL } from "./envs"

export async function overrideLocalStorage(docId: string) {
  window.localStorage.clear()
  const {
    port,
    initialStore,
  }: { port: MessagePort; initialStore: { [key: string]: string } } =
    await new Promise(async res => {
      console.log("added msg event listener")
      window.addEventListener("message", ev => {
        console.log("HERE", ev.data)
        if (ev.data != "localStorageInit") return
        const port = ev.ports[0]
        console.log("port")
        port.addEventListener("message", async event => {
          const msgData = event.data
          console.log(msgData)
          switch (msgData.call) {
            case "storageEvent":
              initialStore[msgData.key] = msgData.newValue
              window.dispatchEvent(
                new StorageEvent("storage", {
                  ...msgData,
                  url: `${new URL(await SUBDOMAIN_WILDCARD_URL).origin}/${docId}`,
                  storageArea: window.localStorage,
                })
              )
              break
            case "init":
              res({ port, initialStore: msgData.initialStore })
          }
        })
        port.start()
      })
    })
  console.log("Got ls init")
  const localStorage = new Proxy(initialStore as Storage, {
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
            console.log(target, key)
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
          symbol.toString()
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
        "*"
      )
      return out
    },
  })
  Object.defineProperty(window, "localStorage", {
    value: localStorage,
    writable: true,
  })
  port.postMessage({
    call: "initialized",
  })
}

export async function localStorageParentSetup(
  docId: string,
  iframe: HTMLIFrameElement
) {
  const { port1: port, port2: childPort } = new MessageChannel()
  if (iframe.contentWindow) {
    iframe.contentWindow.postMessage("localStorageInit", "*", [childPort])
  } else {
    iframe.addEventListener("load", () => {
      iframe.contentWindow?.postMessage("localStorageInit", "*", [childPort])
    })
  }
  const [initialStore, db] = await new Promise<
    [
      {
        [key: string]: string
      },
      db: IDBDatabase
    ]
  >((res, rej) => {
    let initialLocalStorage: { [key: string]: string } = {}
    const DBOpenRequest = window.indexedDB.open(docId)
    DBOpenRequest.addEventListener("success", _ => {
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
    DBOpenRequest.addEventListener("error", _ => {
      rej(DBOpenRequest.error)
    })
  })
  let res: () => void
  const childInitialized = new Promise<void>(r => {
    res = r
  })
  port.onmessage = event => {
    const objStore = db.transaction(docId, "readwrite").objectStore(docId)
    switch (event.data.call) {
      case "setItem":
        localStorage.setItem(
          `localStorage:${docId}:${encodeURIComponent(event.data.key)}`,
          event.data.value
        )
        objStore.put(event.data.value, event.data.key)
        break
      case "removeItem":
        // uri encode key so that we can safely use ":" as a deliminator
        localStorage.removeItem(
          `localStorage:${docId}:${encodeURIComponent(event.data.key)}`
        )
        objStore.delete(event.data.key)
        break
      case "initialized":
        res()
    }
  }
  port.postMessage({ call: "init", initialStore })
  console.log("Posted init message")
  window.addEventListener("storage", event => {
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
