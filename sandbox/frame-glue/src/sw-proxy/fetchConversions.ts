import { FetchEvent as FetchEventPolyfill } from "./fetchEventPolyfill"
import type { ProxiedFetchRequest } from "./sw-passthrough-api"

export function stringifiableRequestInit(
  obj: object
): Exclude<RequestInit & { url: string }, "headers"> {
  const filtered: RequestInit = {}
  for (const k in obj) {
    const key = k as keyof typeof obj
    if (
      ["boolean", "number", "string"].includes(typeof obj[key]) ||
      obj[key] === null
    )
      filtered[key] = obj[key]
  }
  return filtered as RequestInit & { url: string }
}

export function responseToResponseInit(res: Response): ResponseInit {
  return {
    headers: Object.fromEntries(res.headers),
    status: res.status,
    statusText: res.statusText,
  }
}

export function proxiedRequestToFetchEvent(data: ProxiedFetchRequest) {
  const request = requestFromObject(data.params.request)
  return new FetchEventPolyfill("fetch", {
    request,
    clientId: data.params.clientId,
    replacesClientId: data.params.replacesClientId,
    resultingClientId: data.params.resultingClientId,
  }) as FetchEvent
}

export type ClonableRequest = Awaited<ReturnType<typeof requestAsObject>>

export async function requestAsObject(
  request: Request
): Promise<[string, RequestInit]> {
  const arrayBuffer = await request.arrayBuffer()
  const { url, ...rest } = stringifiableRequestInit(request)
  const requestInit = {
    ...rest,
    headers: Object.fromEntries(request.headers),
    body: arrayBuffer,
  }
  // signal can be omitted because abortSignals aren't functional in service
  // workers anyway
  //
  // see /references.md#1-abortsignal-in-service-worker-nonfunctional
  return [url, requestInit]
}

export function requestFromObject(request: ClonableRequest) {
  const [url, requestInit] = request
  if (["GET", "HEAD"].includes(requestInit.method ?? "")) {
    delete requestInit.body
  }
  return new Request(new URL(url), requestInit)
}
