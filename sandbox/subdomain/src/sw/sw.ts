/// <reference lib="webworker" />
export type {}
declare const self: ServiceWorkerGlobalScope
import { proxyFetchEvent, sendInitEvent } from "frame-glue"

let mainSwPromises: Map<
  string,
  {
    promise: Promise<MessagePort>
    // undefined if is set
    set?: (port: MessagePort) => void
    get isSet(): boolean
  }
> = new Map()

self.addEventListener("install", () => {
  self.skipWaiting() // makes service worker install immediately
})

self.addEventListener("activate", e => {
  // makes service worker activate immediately for all requests going forward
  // console.log("activating")
  // if (self.registration.installing)
  e.waitUntil(self.clients.claim())
  // else {
  console.log(self.registration)
  // }
})

self.addEventListener("message", event => {
  // should only ever be the port to the main page's sw
  // if *this* service worker is being mounted to the page
  console.log((event.source as Client).id)
  if (event.data != "init-sw-proxy") {
    console.warn("unexpected message to ghost proxy")
    return
  }

  // in order to reuse a service worker that has already been used
  const id = (event.source as Client).id
  let mainSwPromise = mainSwPromises.get(id)
  if (mainSwPromise == undefined) {
    const promise = new Promise<MessagePort>(res => res(event.ports[0]))
    mainSwPromise = {
      promise,
      set: undefined, // already set
      get isSet() {
        return this.promise == undefined
      },
    }
    mainSwPromises.set(id, mainSwPromise)
    sendInitEvent(event.ports[0])
  } else {
    if (mainSwPromise.set) {
      mainSwPromise.set(event.ports[0])
      delete mainSwPromise.set
      sendInitEvent(event.ports[0])
    }
  }
})

self.addEventListener("fetch", event => {
  event.respondWith(
    (async () => {
      const url = new URL(event.request.url)
      if (
        event.request.method == "GET" &&
        url.origin == self.origin &&
        url.pathname.startsWith("/pg-doc-id/") &&
        url.pathname.split("/").filter(v => v != "").length == 2
      ) {
        if (url.search.length == 0 && (await event.request.text()) == "") {
          return await fetch(event.request)
        } else {
          throw new Error("invalid request")
        }
      }
      let mainSwPromise = mainSwPromises.get(event.clientId)
      if (!mainSwPromise) {
        let set
        const promise = new Promise<MessagePort>(res => (set = res))
        mainSwPromise = {
          set,
          promise,
          get isSet() {
            return this.promise == undefined
          },
        }
        mainSwPromises.set(event.clientId, mainSwPromise)
        console.log(":(", await self.clients.matchAll())
        self.clients.get(event.clientId).then(c => {
          if (c == undefined) {
            console.warn("Unexpected")
            return
          }
          c.postMessage("refresh port")
        })
      }
      const mainSw = await mainSwPromise.promise
      return proxyFetchEvent(mainSw, event)
    })()
  )
})
