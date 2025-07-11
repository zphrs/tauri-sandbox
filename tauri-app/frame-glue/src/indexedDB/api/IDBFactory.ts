import type { Method } from "."

export type DatabaseMethod = Method<[], IDBDatabaseInfo[], "databases">
/**
 * The MessagePort's messages conform to the IDBOpenDBRequestRequests API
 */
export type DeleteDatabaseMethod = Method<
  [name: string],
  MessagePort,
  "deleteDatabase"
>
/**
 * Response
 */
export type OpenMethod = Method<
  [name: string, version?: number],
  MessagePort,
  "open"
>

type IDBFactoryMethods = DatabaseMethod | DeleteDatabaseMethod | OpenMethod

export type IDBFactoryRequests = IDBFactoryMethods["req"]
export type IDBFactoryResults = IDBFactoryMethods["req"]
