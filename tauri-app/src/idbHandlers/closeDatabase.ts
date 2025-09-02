import { Handlers } from "frame-glue/lib/src/indexedDB/methods-scaffolding/setupIDBMethodHandlers"

export const closeDatabase: Handlers["closeDatabase"] = async (
  docId,
  { name }
) => {
  // TODO
  return null
}
