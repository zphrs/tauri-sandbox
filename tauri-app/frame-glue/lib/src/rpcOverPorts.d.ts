export type Method<MethodName extends string, Params, Result> = {
    name: MethodName;
    req: Request<MethodName, Params>;
    res: Response<Result>;
};
export type Id = string | number;
export type Notification<Method extends string, Params> = {
    method: Method;
    params: Params;
};
export type Request<Method extends string, Params> = Notification<Method, Params> & {
    id: Id;
};
export type Response<Result> = {
    result: Result;
    id: Id;
};
export declare function responseFromResult<Result>(result: Result, { id }: Request<string, unknown>): {
    result: Result;
    id: Id;
};
export declare function notify<Notif extends Notification<string, unknown>>(port: MessagePort, notification: Notif, transferableObjects?: Transferable[]): void;
export declare function getId(): number;
export type HandlerOf<M extends Method<string, unknown, unknown>> = (req: M["req"]["params"]) => Promise<M["res"]["result"] | {
    result: M["res"]["result"];
    transferableObjects: Transferable[];
}>;
export declare function handleRequests<M extends Method<string, unknown, unknown>>(port: MessagePort, methodName: M["name"], handler: HandlerOf<M>): void;
export declare function call<M extends Method<string, unknown, unknown>>(port: MessagePort, method: M["req"]["method"], params: M["req"]["params"] | {
    params: M["req"]["params"];
    transferableObjects: Transferable[];
}): Promise<M["res"]["result"]>;
