import { todo } from "frame-glue/lib/src/indexedDB/methods-scaffolding"
import { Handlers } from "frame-glue/lib/src/indexedDB/methods-scaffolding/setupIDBMethodHandlers"
import { WriteMethods } from "frame-glue/lib/src/indexedDB/methods-scaffolding/types/transaction"

export const executeTransaction: Handlers["executeTransaction"] = async (
  docId,
  req
) => {
  for (const storeName in req.ops) {
    for (const op of req.ops[storeName]) {
      switch (op.method) {
        case "add":
          handleAdd(docId, storeName, op.params)
          break
        case "clear":
          await handleClear(docId, storeName, op.params)
          break
        case "delete":
          await handleDelete(docId, storeName, op.params)
          break
        case "put":
          await handlePut(docId, storeName, op.params)
          break
        case "replace":
          await handleReplace(docId, storeName, op.params)
          break
      }
    }
  }
  return undefined
}

async function handleAdd(
  docId: string,
  storeName: string,
  op: WriteMethods["add"]["params"]
) {
  // TODO: Handle the "add" operation
  todo()
}

async function handleClear(
  docId: string,
  storeName: string,
  op: WriteMethods["clear"]["params"]
) {
  // TODO: Handle the "clear" operation
  todo()
}

async function handleDelete(
  docId: string,
  storeName: string,
  op: WriteMethods["delete"]["params"]
) {
  // TODO: Handle the "delete" operation
  todo()
}

async function handlePut(
  docId: string,
  storeName: string,
  op: WriteMethods["put"]["params"]
) {
  // TODO: Handle the "put" operation
  todo()
}

async function handleReplace(
  docId: string,
  storeName: string,
  op: WriteMethods["replace"]["params"]
) {
  // TODO: Handle the "replace" operation
  todo()
}
