import { invoke } from "@tauri-apps/api/core";
import { NONCE } from "./main";

export let SUBDOMAIN_WILDCARD_URL = new Promise<string>(async res => {
    // FIXME: fix this silly hack :)
    await new Promise(res => setTimeout(res, 100));
    invoke<string>(`get_sandbox_url${NONCE}`).then(res);
})
