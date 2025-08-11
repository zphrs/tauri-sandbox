import { extendObjectWithEvents } from "./eventTarget"
import { createError } from "./exceptions"

export function idbRequestFromPromise<Result>(
    promise: Promise<Result>,
    source: IDBObjectStore | IDBIndex | IDBCursor
): IDBRequest<Result> {
    return idbRequestFromPromiseInternal(promise, source).request
}
/**
 * converts a promise to an IDBRequest
 * @param promise
 * @param source is null iff it is an open request
 * @returns
 */
function idbRequestFromPromiseInternal<Result>(
    promise: Promise<Result>,
    source: IDBObjectStore | IDBIndex | IDBCursor | null
): { request: IDBRequest<Result>; setResult: (result: Result) => void } {
    let result: Result | null = null // on error becomes undefined
    let error: DOMException | null | undefined = undefined
    let readyState: "pending" | "done" = "pending"
    const out = extendObjectWithEvents(
        Object.setPrototypeOf(
            {
                get error() {
                    // error is undefined while pending
                    if (error === undefined) throw createError("InvalidState")
                    return error
                },
                get readyState() {
                    return readyState
                },
                get result(): Result {
                    // result is null while pending
                    if (result === null) throw createError("InvalidState")
                    return result
                },
                get source() {
                    // only null when wrapped in an open request
                    return source as IDBObjectStore | IDBIndex | IDBCursor
                },
                transaction: null,
            } satisfies Omit<
                IDBRequest<Result>,
                keyof EventTarget | "onsuccess" | "onerror"
            >,
            IDBRequest
        ),
        ["error", "success"] as const
    ) satisfies IDBRequest<Result>
    const oldDispatch: Function = out.dispatchEvent
    out.prototype.dispatchEvent = (...params: any[]) => {
        setTimeout(oldDispatch.bind(out, ...params), 0)
    }
    promise
        .then((v) => {
            result = v
            // null because it succeeded
            error = null
            readyState = "done"
            out.dispatchEvent(new Event("success"))
        })
        .catch((err: DOMException) => {
            error = err
            // undefined because it failed
            result = undefined as typeof result
            readyState = "done"
            out.dispatchEvent(new Event("error"))
        })
    return { request: out, setResult: (res) => (result = res) }
}
export type OpenRequestPromise = Promise<
    | {
          result: IDBDatabase
          nextPromise?: Promise<{ result: IDBDatabase }>
      }
    | { result: "blocked"; nextPromise: Promise<OpenRequestPromise> }
>
/**
 *
 * @param successPromise resolve on success, reject on error
 * @returns the request, a function to broadcast a blocked event,
 * and a function to broadcast a upgradeNeeded request
 */
export function createIdbOpenRequest(successPromise: Promise<IDBDatabase>): {
    request: IDBOpenDBRequest
    broadcastBlocked: () => void
    broadcastUpgradeNeeded: (
        db: IDBDatabase,
        oldVersion: number,
        newVersion: number
    ) => void
} {
    const { request, setResult } = idbRequestFromPromiseInternal(
        successPromise,
        null
    )
    const reqFromPromise = extendObjectWithEvents(request, [
        "upgradeneeded",
        "blocked",
    ] as const) satisfies IDBOpenDBRequest
    return {
        request: reqFromPromise,
        broadcastBlocked() {
            reqFromPromise.dispatchEvent(new Event("blocked"))
        },
        broadcastUpgradeNeeded(db, oldVersion: number, newVersion: number) {
            setResult(db)
            reqFromPromise.dispatchEvent(
                new IDBVersionChangeEvent("version", {
                    oldVersion,
                    newVersion,
                })
            )
        },
    }
}
