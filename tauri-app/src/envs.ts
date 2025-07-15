import { invoke } from "@tauri-apps/api/core";


export const NONCE = crypto.randomUUID()
export let sentNonce = new Promise<void>(res => {
    window.addEventListener("DOMContentLoaded", async () => {
        // send nonce to isolation sandbox, wait 100ms to ensure that iframe loads in
        const iframe: HTMLIFrameElement | null = document.querySelector("iframe#__tauri_isolation__")
        if (!iframe) throw new Error("No iframe found")
        window.addEventListener("message", (e) => {
            console.log("got message")
            const { method, id } = e.data
            if (method != "nonce") return
            iframe.contentWindow?.postMessage({ id, result: { nonce: NONCE } }, "*")
        })
        await new Promise(res => setTimeout(res, 0))
        res()
    });
})


export let SUBDOMAIN_WILDCARD_URL = new Promise<string>(async res => {
    await sentNonce
    invoke<string>(`get_sandbox_url${NONCE}`).then(res);
})
