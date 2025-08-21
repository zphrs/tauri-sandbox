export type Method<MethodName extends string, Params, Result> = {
    name: MethodName
    req: Request<MethodName, Params>
    res: Response<Result>
}
export type Id = string | number

export type Notification<Method extends string, Params> = {
    method: Method
    params: Params
}

export type Request<Method extends string, Params> = Notification<
    Method,
    Params
> & {
    id: Id
}

/// not handling errors at all
export type Response<Result> = {
    result: Result
    id: Id
}

export function responseFromResult<Result>(
    result: Result,
    { id }: Request<string, unknown>,
) {
    return {
        result,
        id,
    }
}

export function notify<Notif extends Notification<string, unknown>>(
    port: MessagePort,
    notification: Notif,
    transferableObjects?: Transferable[],
) {
    port.postMessage(notification, transferableObjects ?? [])
}

let idIncrement = Number.MIN_SAFE_INTEGER

export function getId() {
    if (idIncrement === Number.MAX_SAFE_INTEGER) {
        console.error(
            "idIncrement wrapped around; could lead to errors with id reuse",
        )
        idIncrement = Number.MIN_SAFE_INTEGER // wrap around; highly unlikely for this to occur
    }
    return idIncrement++
}

export function handleRequests<M extends Method<string, unknown, unknown>>(
    port: MessagePort,
    methodName: M["name"],
    handler: (
        req: M["req"]["params"],
    ) => Promise<
        | M["res"]["result"]
        | { result: M["res"]["result"]; transferableObjects: Transferable[] }
    >,
) {
    const handleMessage = async (e: MessageEvent<M["req"]>) => {
        if (e.data.method !== methodName) {
            return
        }
        const res:
            | M["res"]["result"]
            | {
                  result: M["res"]["result"]
                  transferableObjects: Transferable[]
              } = await handler(e.data.params)
        const resHasTransferableObjects =
            typeof res === "object" &&
            res !== null &&
            "result" in res &&
            "transferableObjects" in res
        port.postMessage(
            responseFromResult(
                resHasTransferableObjects ? res.result : res,
                e.data,
            ) satisfies M["res"],
            resHasTransferableObjects ? res.transferableObjects : [],
        )
    }
    port.addEventListener("message", (e: MessageEvent<M["req"]>) => {
        void handleMessage(e)
    })
    port.start()
}

function createRequest<Params, MethodName extends string>(
    method: MethodName,
    params: Params,
): Request<MethodName, Params> {
    return {
        method,
        params,
        id: getId(),
    }
}
export async function call<M extends Method<string, unknown, unknown>>(
    port: MessagePort,
    method: M["req"]["method"],
    params:
        | M["req"]["params"]
        | { params: M["req"]["params"]; transferableObjects: Transferable[] },
): Promise<M["res"]["result"]>
export async function call<MethodName extends string, Params, Result>(
    port: MessagePort,
    method: MethodName,
    params: Params | { params: Params; transferableObjects: Transferable[] },
): Promise<Response<Result>["result"]> {
    type M = Method<MethodName, Params, Result>
    const reqHasTransferableObjects =
        typeof params === "object" &&
        params !== null &&
        "params" in params &&
        "transferableObjects" in params
    const request = createRequest(
        method,
        reqHasTransferableObjects ? params["params"] : params,
    )
    const out = new Promise<M["res"]["result"]>((res) => {
        const handleMessage = (e: MessageEvent<M["res"]>) => {
            if (e.data.id === request.id) {
                res(e.data.result)
                port.removeEventListener("message", handleMessage)
            }
        }
        port.addEventListener("message", handleMessage)
        port.start()
    })
    notify(
        port,
        request,
        reqHasTransferableObjects ? params["transferableObjects"] : [],
    )
    return out
}
