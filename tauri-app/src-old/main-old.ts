import { invoke } from "@tauri-apps/api/core";

let greetInputEl: HTMLInputElement | null;
let greetMsgEl: HTMLElement | null;

let nonce = crypto.randomUUID()


async function greet() {
  if (greetMsgEl && greetInputEl) {
    // Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
    greetMsgEl.textContent = await invoke(`greet${nonce}`, {
      name: greetInputEl.value,
    });
  }
}

window.addEventListener("DOMContentLoaded", async () => {
  // send nonce to isolation sandbox, wait 100ms to ensure that iframe loads in
  await new Promise(res => setTimeout(res, 100))
  const iframe: HTMLIFrameElement | null = document.querySelector("iframe#__tauri_isolation__")
  if (!iframe) throw new Error("No iframe found")
  iframe.contentWindow?.postMessage({ method: "nonce", data: { nonce } }, "*")
  greetInputEl = document.querySelector("#greet-input");
  greetMsgEl = document.querySelector("#greet-msg");
  document.querySelector("#greet-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    greet();
  });

});
