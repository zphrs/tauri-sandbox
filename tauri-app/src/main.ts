import "./style.css"
import { createSandbox } from "./sandbox.ts"
import { InitParams } from "./proxy-sw/Interface.ts";
import { SUBDOMAIN_WILDCARD_URL } from "./envs.ts";

export const NONCE = crypto.randomUUID()
export let sentNonce = new Promise<void>(res => {
  window.addEventListener("DOMContentLoaded", async () => {
    // send nonce to isolation sandbox, wait 100ms to ensure that iframe loads in
    // FIXME: fix this silly hack :)
    await new Promise(res => setTimeout(res, 10))
    const iframe: HTMLIFrameElement | null = document.querySelector("iframe#__tauri_isolation__")
    if (!iframe) throw new Error("No iframe found")
    iframe.contentWindow?.postMessage({ method: "nonce", data: { nonce: NONCE } }, "*")
    await new Promise(res => setTimeout(res, 0))
    res()
  });
})



async function init(
  appId: string = "exploits",
  docId: string = "excalidraw"
) {
  await sentNonce;
  let parent = document.querySelector<HTMLDivElement>("#app")!
  let doc = await (await fetch(`/${appId}/index.html`)).text()
  const { port1, port2 } = new MessageChannel()
  const worker = new Worker(new URL("./proxy-sw/sw.ts", import.meta.url), {
    type: "module",
  })

  const initDone = new Promise<void>(res => {
    worker.addEventListener("message", e => {
      console.log(e)
      if (e.data == "proxy-sw init done") res()
    })
  })

  worker.postMessage({ appId, subdomainUrl: await SUBDOMAIN_WILDCARD_URL } satisfies InitParams, [port2])
  await initDone
  const { setPort } = await createSandbox(parent, port1, doc, docId)
  const w = worker
  window.addEventListener("message", async e => {
    if (e.data != "iframe refresh port") return

    const { port1, port2 } = new MessageChannel()
    w.terminate()
    const worker = new Worker(new URL("./proxy-sw/sw.ts", import.meta.url), {
      type: "module",
    })
    const initDone = new Promise<void>(res => {
      worker.addEventListener("message", e => {
        console.log(e)
        if (e.data == "proxy-sw init done") res()
      })
    })

    worker.postMessage({ appId }, [port2])
    await initDone
    setPort(port1)
  })
}
init("excalidraw")
