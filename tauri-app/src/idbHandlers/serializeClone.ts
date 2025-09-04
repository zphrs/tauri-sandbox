import { serialize, deserialize } from "@workers/v8-value-serializer";

export function serializeClone(object: unknown) {
  return serialize(object, { forceUtf8: true });
}

export function deserializeClone(buf: ArrayBuffer): unknown {
  return deserialize(buf, { forceUtf16: true });
}
