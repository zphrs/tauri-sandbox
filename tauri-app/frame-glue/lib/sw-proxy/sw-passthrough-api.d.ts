import { ClonableRequest } from './fetchConversions';
export type {};
export type ProxiedFetchRequest = {
    id: string | number;
    params: Omit<FetchEventInit, "request"> & {
        request: ClonableRequest;
    };
};
type SuccessfulProxiedResponse = {
    result: {
        arrBuf: ArrayBuffer;
        responseInit: ResponseInit;
    };
    id: string | number;
};
export type ProxiedResponse = SuccessfulProxiedResponse;
/**
 * Used in an onfetch event in the iframe's service worker
 * @param port
 * @param symbol
 * @param request
 * @param clientId
 * @param resultingClientId
 * @returns
 */
export declare function proxyFetchEvent(port: MessagePort, event: FetchEvent): Promise<Response>;
export declare function sendInitEvent(port: MessagePort): Promise<void>;
/**
 * Used on the client's main page (or within a worker) to handle requests
 * @param port
 * @param onfetch
 */
export declare function handleProxiedFetchEvent(port: MessagePort, onfetch: (event: FetchEvent) => void): Promise<() => void>;
