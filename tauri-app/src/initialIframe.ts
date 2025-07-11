import { overrideCookie } from "frame-glue"
import { overrideLocalStorage } from "./overrideLocalStorage"
export function getInitialIframeScript(docId: string): HTMLScriptElement {
  const out = document.createElement("script")
  out.innerHTML = `
    // ${overrideLocalStorage.toString()};
    // overrideLocalStorage("${docId}");
    ${overrideCookie};
    overrideCookie()
  `
  return out
}
