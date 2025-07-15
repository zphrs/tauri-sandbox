/// <reference lib="webworker" />
// TODO: Fix how subdomains get sent and received
import { handleProxiedFetchEvent } from "frame-glue"
import type { InitParams } from "./Interface"



const inited = false
self.addEventListener("message", async (event: MessageEvent<InitParams>) => {
  console.log("proxy init")
  if (inited) {
    console.warn("Proxy SW has already been initialized")
    return
  }
  const { appId, subdomainUrl } = event.data
  self.postMessage("proxy-sw init done")
  handleProxiedFetchEvent(event.ports[0], event => {
    // TODO: show popup, possibly forward event too
    const initUrl = new URL(event.request.url)
    if (
      initUrl
        .toString()
        .startsWith("https://esm.sh/@excalidraw/excalidraw/dist/prod/")
    ) {
      const newUrl = `${origin}/${appId}/${initUrl.pathname
        .split("/")
        .slice(5)
        .join("/")}`
      console.log(newUrl)
      const req = new Request(newUrl, event.request)
      event.respondWith(fetch(req))
      return
    }
    if (initUrl.origin != new URL(subdomainUrl).origin) {
      console.log("Blocking external request")
      event.respondWith(
        (async () =>
          new Response("Blocked cross-origin request", {
            status: 403,
          }))()
      )
      return
    }
    const newUrl = new URL(`${origin}/${appId}${initUrl.pathname}`)
    console.log("NEW", newUrl.toString())
    const req = new Request(newUrl, event.request)
    event.respondWith(fetch(req))
  })
})
