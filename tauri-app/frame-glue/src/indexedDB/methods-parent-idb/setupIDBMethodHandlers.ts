import { handlers } from "."

import {
    setupIndexedDBMethodHandlers,
    setupIndexedDBMethodHandlersFromPort,
} from "../methods-scaffolding/setupIDBMethodHandlers"

export async function setupIDBMethodHandlersFromPort(
    port: MessagePort,
    docId: string,
) {
    setupIndexedDBMethodHandlersFromPort(port, docId, handlers)
}

export async function setupIDBMethodHandlers(window: Window, docId: string) {
    setupIndexedDBMethodHandlers(window, docId, handlers)
}
