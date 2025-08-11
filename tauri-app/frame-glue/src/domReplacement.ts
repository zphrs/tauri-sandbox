export function domReplacement() {
    console.log("HERE")
    window.addEventListener("message", (ev) => {
        if (ev.data != "domReplacementInit") return
        const port = ev.ports[0]
        port.onmessage = async (ev) => {
            window.document.documentElement.innerHTML = ev.data
            const scripts = document.querySelectorAll("script")
            for (const node of scripts) {
                const script = document.createElement("script")
                //copy over the attributes
                for (const attribute of node.attributes) {
                    script.setAttribute(
                        attribute.nodeName,
                        attribute.nodeValue!,
                    )
                }
                script.innerText = node.innerText
                node.replaceWith(script)
            }
        }
        port.postMessage("inited")
    })
}

export async function sleep(s: number): Promise<void> {
    return new Promise((res) => {
        setTimeout(() => {
            res()
        }, s * 1000)
    })
}

export async function domReplacementParentSetup(
    iframe: HTMLIFrameElement,
): Promise<(newDom: string) => void> {
    const { port1: port, port2: childPort } = new MessageChannel()
    const waitTillInited = new Promise<void>((res) => {
        port.addEventListener("message", () => {
            res()
        })
        port.start()
    })
    if (iframe.contentWindow) {
        iframe.contentWindow.postMessage("domReplacementInit", "*", [childPort])
    } else {
        iframe.addEventListener("load", () => {
            console.log("Iframe loaded")
            iframe.contentWindow!.postMessage("domReplacementInit", "*", [
                childPort,
            ])
        })
    }
    await waitTillInited

    return (newDom: string) => {
        console.log("Posting replacement message")
        port.postMessage(newDom)
    }
}
