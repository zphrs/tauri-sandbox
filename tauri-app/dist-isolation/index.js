window.__TAURI_ISOLATION_HOOK__ = (payload) => {
    // let's not verify or modify anything, just print the content from the hook
    /**@type {string} */
    const cmd = payload.cmd
    console.log('hook', payload, window.nonce);
    if (!cmd.endsWith(window.nonce)) {
        return
    }
    return { ...payload, cmd: cmd.slice(0, cmd.length - window.nonce.length) };
};
const controller = new AbortController()
const { signal } = controller
window.addEventListener("message", (evt) => {
    console.log(evt)
    const { id, result } = evt.data
    if (id != 'nonce') return
    controller.abort()
    window.nonce = result.nonce
}, { signal })

window.parent.postMessage({ method: "nonce", id: "nonce" }, "*");
