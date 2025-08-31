import type { HandlerOf, Method } from "../../../rpcOverPorts"

// Re-export all types from organized files
export * from "./database"
export * from "./transaction"
export * from "./store"
export * from "./upgrade"
export * from "./read"

export type HandlerWithDocId<M extends Method<string, unknown, unknown>> = (
    this: undefined,
    docId: string,
    ...args: Parameters<HandlerOf<M>>
) => ReturnType<HandlerOf<M>>
