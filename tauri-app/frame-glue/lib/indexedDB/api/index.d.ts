export type Request<Params, Method extends string> = {
    id: string | number
    method: Method
    params: Params
}
export type Response<Result> = {
    id: string | number
    result: Result
}
export type Method<Params, Result, MethodName extends string> = {
    req: Request<Params, MethodName>
    res: Response<Result>
}
export type DatabasesAPI = Method<[], IDBDatabaseInfo[], "databases">
export type DeleteDatabaseAPI = Method<
    [name: string],
    MessagePort,
    "deleteDatabase"
>
export * from "./IDBFactory"
