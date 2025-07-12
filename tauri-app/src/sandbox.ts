import { domReplacementParentSetup, localStorageParentSetup } from "frame-glue"
import { getInitialIframeScript } from "./initialIframe"
import { invoke } from "@tauri-apps/api/core"
import { NONCE } from "./main"

function composeDocument(html: string): Document {
  let doc = document.implementation.createHTMLDocument()
  doc.documentElement.innerHTML = html
  // doc.head.prepend(createCspMeta())
  return doc
}

/**
 *
 * @param parent
 * @param port
 * @param index
 * @param docId
 * @returns
 */
export async function createSandbox(
  parent: HTMLElement,
  port: MessagePort,
  index?: string,
  docId = "test"
) {
  const url = await invoke<string>(`get_sandbox_url${NONCE}`);

  let iframe = document.createElement("iframe")
  let iframeScript = getInitialIframeScript(docId)
  let initialDoc = composeDocument(iframeScript.outerHTML)

  iframe.src = `${url}/${encodeURIComponent(docId)}`

  iframe.sandbox.add("allow-scripts")
  iframe.sandbox.add("allow-same-origin")
  iframe.allow = "clipboard-write"
  iframe.referrerPolicy = "no-referrer"
  const iframeInited = new Promise<void>(res => {
    window.addEventListener("message", e => {
      if (e.data == "iframe inited") {
        res()
      }
    })
  })
  parent.appendChild(iframe)
  await iframeInited
  const replaceDom = await domReplacementParentSetup(iframe)
  // wait for response
  const setPort = async (port: MessagePort) => {
    const swInited = new Promise<void>((res, rej) => {
      window.addEventListener(
        "message",
        e => {
          if (e.data == "init-proxied-sw port inited") res()
          else rej("wrong message type")
        },
        {
          once: true,
        }
      )
    })
    iframe.contentWindow?.postMessage("init-proxied-sw port", "*", [port])
    await swInited
  }
  await setPort(port)
  replaceDom(initialDoc.documentElement.outerHTML)
  await localStorageParentSetup(docId, iframe)
  let html =
    index ??
    `
    <script>
    console.log("Successfully ran script")
    </script>
    <script src="test.js"></script>

    Hello world!
    `
  let doc = composeDocument(html)
  replaceDom(doc.documentElement.outerHTML)
  // iframe.src = `data:text/html;base64,${btoa(doc.documentElement.outerHTML)}`
  return { setPort }
}
