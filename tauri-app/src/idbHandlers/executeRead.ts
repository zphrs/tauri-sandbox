import { todo } from "frame-glue/lib/src/indexedDB/methods-scaffolding";
import { Handlers } from "frame-glue/lib/src/indexedDB/methods-scaffolding/setupIDBMethodHandlers";
import { GetAllKeysMethod } from "frame-glue/lib/src/indexedDB/methods-scaffolding/types/read";
import {
  GetAllRecordsMethod,
  GetAllRecordsFromIndexMethod,
  GetNextFromCursorMethod,
} from "frame-glue/lib/src/indexedDB/methods-scaffolding/types/read";

export const executeRead: Handlers["executeRead"] = (docId, req) => {
  switch (req.call.method) {
    case "getAllKeys":
      return handleGetAllKeys(docId, req.dbName, req.store, req.call.params);
    case "getAllRecords":
      return handleGetAllRecords(docId, req.dbName, req.store, req.call.params);
    case "getAllRecordsFromIndex":
      return handleGetAllRecordsFromIndex(
        docId,
        req.dbName,
        req.store,
        req.call.params
      );
    case "getNextFromCursor":
      return handleGetNextFromCursor(
        docId,
        req.dbName,
        req.store,
        req.call.params
      );
  }
};

async function handleGetAllKeys(
  id: string,
  dbName: string,
  store: string,
  { count, query }: GetAllKeysMethod["req"]["params"]["call"]["params"]
): Promise<GetAllKeysMethod["res"]["result"]> {
  todo();
}

async function handleGetAllRecords(
  id: string,
  dbName: string,
  store: string,
  { count, query }: GetAllRecordsMethod["req"]["params"]["call"]["params"]
): Promise<GetAllRecordsMethod["res"]["result"]> {
  todo();
}

async function handleGetAllRecordsFromIndex(
  id: string,
  dbName: string,
  store: string,
  {
    indexName,
    count,
    query,
  }: GetAllRecordsFromIndexMethod["req"]["params"]["call"]["params"]
): Promise<GetAllRecordsFromIndexMethod["res"]["result"]> {
  todo();
}

async function handleGetNextFromCursor(
  id: string,
  dbName: string,
  store: string,
  {
    range,
    direction,
    indexName,
    currPrimaryKey,
    prevPrimaryKey,
    justKeys,
  }: GetNextFromCursorMethod["req"]["params"]["call"]["params"]
): Promise<GetNextFromCursorMethod["res"]["result"]> {
  todo();
}
