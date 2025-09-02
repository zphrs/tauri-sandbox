import { todo } from "frame-glue/lib/src/indexedDB/methods-scaffolding"
import { Handlers } from "frame-glue/lib/src/indexedDB/methods-scaffolding/setupIDBMethodHandlers"
import { GetAllKeysMethod } from "frame-glue/lib/src/indexedDB/methods-scaffolding/types/read"
import {
  GetAllRecordsMethod,
  GetAllRecordsFromIndexMethod,
  GetNextFromCursorMethod,
} from "frame-glue/lib/src/indexedDB/methods-scaffolding/types/read"

export const executeRead: Handlers["executeRead"] = (docId, req) => {
  switch (req.call.method) {
    case "getAllKeys":
      return handleGetAllKeys(docId, req.call)
    case "getAllRecords":
      return handleGetAllRecords(docId, req.call)
    case "getAllRecordsFromIndex":
      return handleGetAllRecordsFromIndex(docId, req.call)
    case "getNextFromCursor":
      return handleGetNextFromCursor(docId, req.call)
  }
}

async function handleGetAllKeys(
  id: string,
  call: GetAllKeysMethod["req"]["params"]["call"]
): Promise<GetAllKeysMethod["res"]["result"]> {
  todo()
}

async function handleGetAllRecords(
  id: string,
  call: GetAllRecordsMethod["req"]["params"]["call"]
): Promise<GetAllRecordsMethod["res"]["result"]> {
  todo()
}

async function handleGetAllRecordsFromIndex(
  id: string,
  call: GetAllRecordsFromIndexMethod["req"]["params"]["call"]
): Promise<GetAllRecordsFromIndexMethod["res"]["result"]> {
  todo()
}

async function handleGetNextFromCursor(
  id: string,
  call: GetNextFromCursorMethod["req"]["params"]["call"]
): Promise<GetNextFromCursorMethod["res"]["result"]> {
  todo()
}
