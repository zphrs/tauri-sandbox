/// Loosely follows the jsonRPC spec for cross frame communication
/// https://www.jsonrpc.org/specification
/// <reference lib="WebWorker" />
export type {}
// eslint-disable-next-line @typescript-eslint/no-unused-vars
declare const self: ServiceWorkerGlobalScope
declare const globalThis: ServiceWorkerGlobalScope
import {
    type ClonableRequest,
    responseToResponseInit,
    requestAsObject,
    proxiedRequestToFetchEvent,
} from "./fetchConversions"
export type ProxiedFetchRequest = {
    id: string | number
    params: Omit<FetchEventInit, "request"> & {
        request: ClonableRequest
    }
}

// type ErroredProxyResponse = {
//   id: string | number
//   error: {
//     code: number
//     message: string
//     data: undefined
//   }
// }

type SuccessfulProxiedResponse = {
    result: {
        arrBuf: ArrayBuffer
        responseInit: ResponseInit
    }
    id: string | number
}

export type ProxiedResponse = SuccessfulProxiedResponse

async function sendProxiedResponse(
    port: MessagePort,
    id: string | number,
    res: Response,
) {
    const arrBuf = await res.arrayBuffer()
    port.postMessage(
        {
            result: {
                arrBuf,
                responseInit: responseToResponseInit(res),
            },
            id,
        } satisfies ProxiedResponse,
        [arrBuf],
    )
}
async function receiveProxiedResponse(
    port: MessagePort,
    id: string,
): Promise<Response> {
    const controller = new AbortController()
    return new Promise((res) => {
        port.addEventListener(
            "message",
            (msgEvent: MessageEvent<ProxiedResponse>) => {
                const { id: resId } = msgEvent.data
                if (resId != id) return
                controller.abort() // same as fetch request
                const out = new Response(
                    msgEvent.data.result.arrBuf,
                    msgEvent.data.result.responseInit,
                )
                res(out)
            },
            { signal: controller.signal },
        )
        port.start()
    })
}

/**
 * Used in an onfetch event in the iframe's service worker
 * @param port
 * @param symbol
 * @param request
 * @param clientId
 * @param resultingClientId
 * @returns
 */
export async function proxyFetchEvent(
    port: MessagePort,
    event: FetchEvent,
): Promise<Response> {
    console.log("Proxying ", event)
    const id = globalThis.crypto.randomUUID()
    const reqAsObj = await requestAsObject(event.request)
    port.postMessage(
        {
            params: {
                request: reqAsObj,
                clientId: event.clientId,
                resultingClientId: event.resultingClientId,
            },
            id,
        } satisfies ProxiedFetchRequest,
        reqAsObj[1].body ? [reqAsObj[1].body] : [],
    )
    return receiveProxiedResponse(port, id)
}

export function sendInitEvent(port: MessagePort) {
    port.postMessage({
        id: "init",
    })
}
/**
 * Used on the client's main page (or within a worker) to handle requests
 * @param port
 * @param onfetch
 * @returns a function to call in order to stop handling events
 */
export async function handleProxiedFetchEvent(
    port: MessagePort,
    onfetch: (event: FetchEvent) => void,
): Promise<() => void> {
    const controller = new AbortController()
    await new Promise<void>((res) => {
        port.addEventListener(
            "message",
            (ev: MessageEvent<ProxiedFetchRequest>) => {
                if (ev.data.id == "init") {
                    res()
                    return
                }
                const fetchEvent = proxiedRequestToFetchEvent(ev.data.params)
                fetchEvent.respondWith = async (r) => {
                    sendProxiedResponse(port, ev.data.id, await r)
                }
                onfetch(fetchEvent)
            },
            { signal: controller.signal },
        )
        port.start()
    })
    return controller.abort.bind(controller)
}
