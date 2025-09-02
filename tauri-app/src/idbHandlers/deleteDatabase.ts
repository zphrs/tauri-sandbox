import { Handlers } from "frame-glue/lib/src/indexedDB/methods-scaffolding/setupIDBMethodHandlers"

export const deleteDatabase: Handlers["deleteDatabase"] = async (
  docId,
  { name }
) => {
  // TODO
  return null
}
