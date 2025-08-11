import { ProxiedFetchRequest } from "./sw-passthrough-api"
export declare function stringifiableRequestInit(obj: object): Exclude<
    RequestInit & {
        url: string
    },
    "headers"
>
export declare function responseToResponseInit(res: Response): ResponseInit
export declare function proxiedRequestToFetchEvent(
    data: ProxiedFetchRequest,
): FetchEvent
export type ClonableRequest = Awaited<ReturnType<typeof requestAsObject>>
export declare function requestAsObject(
    request: Request,
): Promise<[string, RequestInit]>
export declare function requestFromObject(request: ClonableRequest): Request
