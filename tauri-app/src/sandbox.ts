import {
  domReplacementParentSetup,
  handlers,
  indexedDBParentSetup,
  localStorageParentSetup,
} from "frame-glue"
import { getInitialIframeScript } from "./initialIframe"

import { SUBDOMAIN_WILDCARD_URL } from "./envs"

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
 * @param html
 * @param docId
 * @returns
 */
export async function createSandbox(
  parent: HTMLElement,
  port: MessagePort,
  html?: string,
  docId = "test"
) {
  let iframe = document.createElement("iframe")

  iframe.src = `${await SUBDOMAIN_WILDCARD_URL}/${encodeURIComponent(docId)}`

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
  const contentWindow: Window =
    iframe.contentWindow ??
    (await new Promise(res => {
      iframe.addEventListener("load", () => {
        res(iframe.contentWindow!)
      })
    }))
  await localStorageParentSetup(docId, contentWindow)
  await indexedDBParentSetup(contentWindow, docId, handlers)
  html =
    html ??
    `
    Hello world!
    `
  let doc = composeDocument(html)
  replaceDom(doc.documentElement.outerHTML)
  // iframe.src = `data:text/html;base64,${btoa(doc.documentElement.outerHTML)}`
  return { setPort }
}
