import "./style.css"
import { createSandbox } from "./sandbox.ts"

async function init(
  appId: string = "excalidraw",
  docId: string = "excalidraw"
) {
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

  worker.postMessage({ appId }, [port2])
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
