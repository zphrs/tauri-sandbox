export declare class FetchEvent extends Event {
    #private
    clientId: string | undefined
    resultingClientId: string | undefined
    request: Request
    handled: Promise<void>
    set respondWith(rw: (resp: Promise<Response>) => void)
    get respondWith(): (resp: Promise<Response>) => void
    get preloadResponse(): Promise<unknown>
    waitUntil(_p: Promise<unknown>): void
    constructor(
        _type: string,
        { request, clientId, resultingClientId, handled }: FetchEventInit,
    )
    [Symbol.toStringTag](): string
}
