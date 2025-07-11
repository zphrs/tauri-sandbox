import {
  domReplacement,
  overrideCookie,
  overrideIndexDB,
  overrideLocalStorage,
} from "frame-glue"

domReplacement()
overrideIndexDB()
overrideCookie()
overrideLocalStorage(new URL(origin).pathname.slice(1))

function refreshPort() {
  window.parent.postMessage("iframe refresh port", "*")
}

async function initSwProxy(port: MessagePort) {
  if (!("serviceWorker" in navigator))
    throw new Error("Service worker is unsupported.")
  console.log("initing sw")
  const existingReg = await navigator.serviceWorker.getRegistration()
  const onInstalled = (controller: ServiceWorker) => {
    console.log("sw installed")
    controller.postMessage("init-sw-proxy", [port])
    console.log("posted port")
    controller.addEventListener("error", e => {
      console.log("SW ERR", e)
    })
    navigator.serviceWorker.addEventListener(
      "message",
      e => {
        console.log("MSG", e)
        if (e.data == "refresh port") {
          refreshPort()
        }
      },
      { once: true }
    )
  }
  const reg =
    existingReg ??
    (await navigator.serviceWorker.register(
      import.meta.env.MODE === "production" ? "/sw.js" : "/dev-sw.js?dev-sw",
      {
        type: import.meta.env.MODE === "production" ? "classic" : "module",
        scope: "/",
      }
    ))
  if (navigator.serviceWorker.controller && reg.active) {
    onInstalled(navigator.serviceWorker.controller)
    return
  }
  console.log(await navigator.serviceWorker.getRegistrations())
  navigator.serviceWorker.addEventListener("controllerchange", async e => {
    console.log(e)
    if (navigator.serviceWorker.controller)
      onInstalled(navigator.serviceWorker.controller)
    else
      console.warn("controller change happened and controller is still null", e)
  })
  // unregister to clean up this sw when the page closes.
  // deregistration only applies after all active clients close

  // reg.unregister()
}
window.addEventListener("message", async (event: MessageEvent<any>) => {
  console.log(event)
  if (event.data == "init-proxied-sw port") {
    console.log("init-proxied-sw", event.data, event.ports.length)
    const portForSw = event.ports[0]
    // sleep to wait for deregistration of the old service worker,
    // if an old sw exists
    initSwProxy(portForSw).then(() => {
      window.parent.postMessage("init-proxied-sw port inited", "*")
    })
  }
})
window.parent.postMessage("iframe inited", "*")
