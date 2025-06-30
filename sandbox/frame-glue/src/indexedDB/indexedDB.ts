// import type { IDBFactoryRequests } from "./api"

async function clearIdb() {
  const dbs = await window.indexedDB.databases()
  await Promise.all(
    dbs.map(db => db.name && window.indexedDB.deleteDatabase(db.name))
  )
}

export async function getMessagePort(portName: string): Promise<MessagePort> {
  return new Promise(res => {
    const { signal, abort } = new AbortController()
    self.addEventListener(
      "message",
      e => {
        if (e.data == portName) {
          e.ports[0].postMessage(`${portName} inited`)
          res(e.ports[0])
          e.stopImmediatePropagation()
          abort()
        }
      },
      { signal }
    )
  })
}

export async function postMessagePort(
  portName: string,
  window: Window,
  port: MessagePort
): Promise<void> {
  window.postMessage(portName, "*", [port])

  return new Promise(res => {
    const { signal, abort } = new AbortController()
    port.addEventListener(
      "message",
      e => {
        if (e.data == `${portName} inited`) {
          res()
          e.stopImmediatePropagation()
          abort()
        }
      },
      { signal }
    )
  })
}

export async function overrideIndexDB() {
  clearIdb()
  // // @ts-expect-error ts(2790)
  // delete window.indexedDB
}

// export async function overrideIndexDB() {
//   const oldIdb = window.indexedDB
//   await clearIdb()
//   const port = await getMessagePort("indexedDB")
//   window.indexedDB = {
//     cmp(first: any, second: any): number {
//       return oldIdb.cmp(first, second)
//     },
//     /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/IDBFactory/databases) */
//     databases(): Promise<IDBDatabaseInfo[]> {},
//     /**
//      * Attempts to delete the named database. If the database already exists and there are open connections that don't close in response to a versionchange event, the request will be blocked until all they close. If the request is successful request's result will be null.
//      *
//      * [MDN Reference](https://developer.mozilla.org/docs/Web/API/IDBFactory/deleteDatabase)
//      */
//     deleteDatabase(name: string): IDBOpenDBRequest {},
//     /**
//      * Attempts to open a connection to the named database with the current version, or 1 if it does not already exist. If the request is successful request's result will be the connection.
//      *
//      * [MDN Reference](https://developer.mozilla.org/docs/Web/API/IDBFactory/open)
//      */
//     open(name: string, version?: number): IDBOpenDBRequest {},
//   }
// }

// export async function indexDBParentSetup(
//   docId: string,
//   iframe: HTMLIFrameElement
// ) {
//   return
//   const { port1: port, port2: childPort } = new MessageChannel()
//   if (iframe.contentWindow) {
//     iframe.contentWindow.postMessage("indexedDBInit", "*", [childPort])
//   } else {
//     iframe.addEventListener("load", () => {
//       iframe.contentWindow?.postMessage("indexedDBInit", "*", [childPort])
//     })
//   }
//   port.onmessage = async (event: MessageEvent<IDBFactoryRequests>) => {
//     switch (event.data.method) {
//       case "databases":
//         break
//       case "deleteDatabase":
//         break
//       case "open":
//         break
//     }
//     const objStore = db.transaction(docId, "readwrite").objectStore(docId)
//     switch (event.data.call) {
//       case "setItem":
//         localStorage.setItem(
//           `localStorage:${docId}:${encodeURIComponent(event.data.key)}`,
//           event.data.value
//         )
//         objStore.put(event.data.value, event.data.key)
//         break
//       case "removeItem":
//         // uri encode key so that we can safely use ":" as a deliminator
//         localStorage.removeItem(
//           `localStorage:${docId}:${encodeURIComponent(event.data.key)}`
//         )
//         objStore.delete(event.data.key)
//         break
//       case "initialized":
//         res()
//     }
//   }
//   port.postMessage({ call: "init", initialStore })
//   console.log("Posted init message")
//   window.addEventListener("storage", event => {
//     if (event.key == null) {
//       // clear event
//       port.postMessage({
//         key: null,
//         oldValue: event.oldValue,
//         newValue: event.newValue,
//       })
//       return
//     }
//     const [ls, dId, encodedKey] = event.key.split(":")
//     if (ls != "localStorage") return
//     if (dId != docId) return
//     const key = decodeURIComponent(encodedKey)
//     port.postMessage({
//       call: "storageEvent",
//       key,
//       oldValue: event.oldValue,
//       newValue: event.newValue,
//     })
//   })
// }
