import "./style.css"
import { createSandbox } from "./sandbox.ts"
import { InitParams } from "./proxy-sw/Interface.ts";
import { SUBDOMAIN_WILDCARD_URL } from "./envs.ts";
import { attachConsole } from '@tauri-apps/plugin-log';

/*const _detach = await */ attachConsole();

async function init(
  appId: string = "exploits",
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

  worker.postMessage({ appId, subdomainUrl: await SUBDOMAIN_WILDCARD_URL } satisfies InitParams, [port2])
  await initDone
  const { setPort } = await createSandbox(parent, port1, doc, `${appId}/${docId}`)
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
init("webxdc-test")
