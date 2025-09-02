var __defProp = Object.defineProperty;
var __typeError = (msg) => {
  throw TypeError(msg);
};
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
var __accessCheck = (obj, member, msg) => member.has(obj) || __typeError("Cannot " + msg);
var __privateGet = (obj, member, getter) => (__accessCheck(obj, member, "read from private field"), getter ? getter.call(obj) : member.get(obj));
var __privateAdd = (obj, member, value) => member.has(obj) ? __typeError("Cannot add the same private member more than once") : member instanceof WeakSet ? member.add(obj) : member.set(obj, value);
var __privateSet = (obj, member, value, setter) => (__accessCheck(obj, member, "write to private field"), setter ? setter.call(obj, value) : member.set(obj, value), value);
var __privateMethod = (obj, member, method) => (__accessCheck(obj, member, "access private method"), method);
var _res, _customRespondWith, _FetchEvent_instances, respondWith_fn, _oldName, _oldName2, _Index_instances, committedName_get;
function domReplacement() {
  window.addEventListener("message", (ev) => {
    if (ev.data != "domReplacementInit") return;
    const port = ev.ports[0];
    port.onmessage = async (ev2) => {
      window.document.documentElement.innerHTML = ev2.data;
      const scripts = document.querySelectorAll("script");
      for (const node of scripts) {
        const script = document.createElement("script");
        for (const attribute of node.attributes) {
          script.setAttribute(
            attribute.nodeName,
            attribute.nodeValue
          );
        }
        script.innerText = node.innerText;
        node.replaceWith(script);
      }
    };
    port.postMessage("inited");
  });
}
async function sleep(s) {
  return new Promise((res) => {
    setTimeout(() => {
      res();
    }, s * 1e3);
  });
}
async function domReplacementParentSetup(iframe) {
  const { port1: port, port2: childPort } = new MessageChannel();
  const waitTillInited = new Promise((res) => {
    port.addEventListener("message", () => {
      res();
    });
    port.start();
  });
  if (iframe.contentWindow) {
    iframe.contentWindow.postMessage("domReplacementInit", "*", [childPort]);
  } else {
    iframe.addEventListener("load", () => {
      iframe.contentWindow.postMessage("domReplacementInit", "*", [
        childPort
      ]);
    });
  }
  await waitTillInited;
  return (newDom) => {
    port.postMessage(newDom);
  };
}
class FetchEvent extends Event {
  constructor(_type, { request, clientId, resultingClientId, handled }) {
    super(
      "fetch"
      /* maybe should replace with type? */
    );
    __privateAdd(this, _FetchEvent_instances);
    __publicField(this, "clientId");
    __publicField(this, "resultingClientId");
    __publicField(this, "request");
    __publicField(this, "handled");
    // @ts-expect-error ts(2564)
    __privateAdd(this, _res);
    __privateAdd(this, _customRespondWith);
    this.request = request;
    this.clientId = clientId ?? globalThis.crypto.randomUUID();
    this.resultingClientId = resultingClientId;
    this.handled = handled ?? new Promise((res) => {
      __privateSet(this, _res, res);
    });
  }
  set respondWith(rw) {
    __privateSet(this, _customRespondWith, rw);
  }
  get respondWith() {
    const t = this;
    return function(resp) {
      if (__privateGet(t, _customRespondWith)) __privateGet(t, _customRespondWith).bind(this, resp)();
      __privateMethod(t, _FetchEvent_instances, respondWith_fn).bind(this, resp)();
    };
  }
  get preloadResponse() {
    return new Promise((res) => res(void 0));
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  waitUntil(_p) {
    console.warn("The waitUntil function in the polyfill is a no-op");
    return;
  }
  [Symbol.toStringTag]() {
    return "FetchEvent";
  }
}
_res = new WeakMap();
_customRespondWith = new WeakMap();
_FetchEvent_instances = new WeakSet();
respondWith_fn = function(p) {
  p.then(() => {
    __privateGet(this, _res).call(this);
  });
};
function stringifiableRequestInit(obj) {
  const filtered = {};
  for (const k in obj) {
    const key = k;
    if (["boolean", "number", "string"].includes(typeof obj[key]) || obj[key] === null)
      filtered[key] = obj[key];
  }
  return filtered;
}
function responseToResponseInit(res) {
  return {
    headers: Object.fromEntries(res.headers),
    status: res.status,
    statusText: res.statusText
  };
}
function proxiedRequestToFetchEvent(data) {
  const request = requestFromObject(data.request);
  return new FetchEvent("fetch", {
    request,
    clientId: data.clientId,
    replacesClientId: data.replacesClientId,
    resultingClientId: data.resultingClientId
  });
}
async function requestAsObject(request) {
  const arrayBuffer = await request.arrayBuffer();
  const { url, ...rest } = stringifiableRequestInit(request);
  console.log(url);
  const requestInit = {
    ...rest,
    headers: Object.fromEntries(request.headers),
    body: arrayBuffer
  };
  return [url, requestInit];
}
function requestFromObject(request) {
  const [url, requestInit] = request;
  if (["GET", "HEAD"].includes(requestInit.method ?? "")) {
    delete requestInit.body;
  }
  return new Request(new URL(url), requestInit);
}
async function sendProxiedResponse(port, id, res) {
  const arrBuf = await res.arrayBuffer();
  port.postMessage(
    {
      result: {
        arrBuf,
        responseInit: responseToResponseInit(res)
      },
      id
    },
    [arrBuf]
  );
}
async function receiveProxiedResponse(port, id) {
  const controller = new AbortController();
  return new Promise((res) => {
    port.addEventListener(
      "message",
      (msgEvent) => {
        const { id: resId } = msgEvent.data;
        if (resId != id) return;
        controller.abort();
        const out = new Response(
          msgEvent.data.result.arrBuf,
          msgEvent.data.result.responseInit
        );
        res(out);
      },
      { signal: controller.signal }
    );
    port.start();
  });
}
async function proxyFetchEvent(port, event) {
  console.log("Proxying ", event);
  const id = globalThis.crypto.randomUUID();
  const reqAsObj = await requestAsObject(event.request);
  port.postMessage(
    {
      params: {
        request: reqAsObj,
        clientId: event.clientId,
        resultingClientId: event.resultingClientId
      },
      id
    },
    reqAsObj[1].body ? [reqAsObj[1].body] : []
  );
  return receiveProxiedResponse(port, id);
}
function sendInitEvent(port) {
  port.postMessage({
    id: "init"
  });
}
async function handleProxiedFetchEvent(port, onfetch) {
  const controller = new AbortController();
  await new Promise((res) => {
    port.addEventListener(
      "message",
      (ev) => {
        if (ev.data.id == "init") {
          res();
          return;
        }
        const fetchEvent = proxiedRequestToFetchEvent(ev.data.params);
        fetchEvent.respondWith = async (r) => {
          sendProxiedResponse(port, ev.data.id, await r);
        };
        onfetch(fetchEvent);
      },
      { signal: controller.signal }
    );
    port.start();
  });
  return controller.abort.bind(controller);
}
function responseFromResult(result, { id }) {
  return {
    result,
    id
  };
}
function notify(port, notification, transferableObjects) {
  port.postMessage(notification, transferableObjects ?? []);
}
let idIncrement = Number.MIN_SAFE_INTEGER;
function getId() {
  if (idIncrement === Number.MAX_SAFE_INTEGER) {
    console.error(
      "idIncrement wrapped around; could lead to errors with id reuse"
    );
    idIncrement = Number.MIN_SAFE_INTEGER;
  }
  return idIncrement++;
}
function handleRequests(port, methodName, handler) {
  const handleMessage = async (e) => {
    if (e.data.method !== methodName) {
      return;
    }
    const res = await handler(e.data.params);
    const resHasTransferableObjects = typeof res === "object" && res !== null && "result" in res && "transferableObjects" in res;
    port.postMessage(
      responseFromResult(
        resHasTransferableObjects ? res.result : res,
        e.data
      ),
      resHasTransferableObjects ? res.transferableObjects : []
    );
  };
  port.addEventListener("message", handleMessage);
  port.start();
}
function createRequest(method, params) {
  return {
    method,
    params,
    id: getId()
  };
}
async function call(port, method, params) {
  const reqHasTransferableObjects = typeof params === "object" && params !== null && "params" in params && "transferableObjects" in params;
  const request = createRequest(
    method,
    reqHasTransferableObjects ? params["params"] : params
  );
  const out = new Promise((res) => {
    const handleMessage = (e) => {
      if (e.data.id === request.id) {
        res(e.data.result);
        port.removeEventListener("message", handleMessage);
      }
    };
    port.addEventListener("message", handleMessage);
    port.start();
  });
  notify(
    port,
    request,
    reqHasTransferableObjects ? params["transferableObjects"] : []
  );
  return out;
}
const receivedPorts = {};
const awaitingPort = {};
async function receivePorts() {
  self.addEventListener("message", (e) => {
    var _a, _b;
    if (((_b = (_a = e.data) == null ? void 0 : _a.params) == null ? void 0 : _b.name) === void 0) {
      return;
    }
    receivedPorts[e.data.params.name] = e.ports[0];
    for (const res of awaitingPort[e.data.params.name]) {
      res(e.ports[0]);
    }
    notify(e.ports[0], {
      method: "setupPort",
      params: { name: e.data.params.name }
    });
  });
}
receivePorts();
async function getMessagePort(portName) {
  if (receivedPorts[portName]) {
    return receivedPorts[portName];
  }
  return new Promise((res) => {
    if (awaitingPort[portName] === void 0) {
      awaitingPort[portName] = [];
    }
    awaitingPort[portName].push(res);
  });
}
async function postMessagePort(portName, window2) {
  const ports = new MessageChannel();
  window2.postMessage(
    {
      method: "setupPort",
      params: {
        name: portName
      }
    },
    "*",
    [ports.port2]
  );
  return new Promise((res) => {
    const { signal, abort } = new AbortController();
    ports.port1.addEventListener(
      "message",
      (e) => {
        if (e.data == `${portName} inited`) {
          res(ports.port1);
          e.stopImmediatePropagation();
          abort();
        }
      },
      { signal }
    );
  });
}
async function overrideLocalStorage(docId) {
  window.localStorage.clear();
  const port = await getMessagePort("localStorage");
  const initialStore = await new Promise((res) => {
    port.addEventListener("message", (event) => {
      const msgData = event.data;
      switch (msgData.call) {
        case "init":
          res(msgData.initialStore);
      }
    });
  });
  port.addEventListener("message", (event) => {
    const msgData = event.data;
    switch (msgData.call) {
      case "storageEvent":
        initialStore[msgData.key] = msgData.newValue;
        window.dispatchEvent(
          new StorageEvent("storage", {
            ...msgData,
            url: `${window.origin}/${docId}`
            //   storageArea: ls,
          })
        );
    }
  });
  port.start();
  const ls = new Proxy(initialStore, {
    get(target, symbol) {
      if (symbol in target) {
        return target[symbol.toString()];
      }
      switch (symbol.toString()) {
        case "setItem":
          return (key, value) => {
            target[key] = value;
            port.postMessage({
              call: "setItem",
              key,
              value
            });
          };
        case "getItem":
          return (key) => {
            return target[key];
          };
        case "removeItem":
          return (key) => {
            delete target[key];
            port.postMessage({
              call: "removeItem",
              key
            });
          };
        case "key":
          return (n) => {
            const keys = Object.keys(target);
            if (n >= keys.length) {
              return null;
            }
            return keys[n];
          };
        case "length":
          return Object.keys(target).length;
      }
    },
    set(target, symbol, newValue) {
      target[symbol.toString()] = newValue;
      if (!["setItem", "getItem", "removeItem", "key", "length"].includes(
        symbol.toString()
      )) {
        port.postMessage({
          call: "setItem",
          key: symbol.toString(),
          value: newValue
        });
      }
      return true;
    },
    deleteProperty(target, key) {
      const out = Reflect.deleteProperty(target, key);
      window.parent.postMessage(
        {
          call: "removeItem",
          key
        },
        "*"
      );
      return out;
    }
  });
  Object.defineProperty(window, "localStorage", {
    value: ls,
    writable: true
  });
  port.postMessage({
    call: "initialized"
  });
}
async function localStorageParentSetup(docId, window2) {
  const port = await postMessagePort("localStorage", window2);
  const [initialStore, db] = await new Promise((res, rej) => {
    const initialLocalStorage = {};
    const dbOpenRequest = window2.indexedDB.open(`localstorage:${docId}`);
    dbOpenRequest.addEventListener("success", () => {
      const db2 = dbOpenRequest.result;
      const tx = db2.transaction(docId);
      const store = tx.objectStore("storage");
      const objStore = store.getAll();
      const objStoreKeys = store.getAllKeys();
      tx.oncomplete = () => {
        for (const [i, key] of objStoreKeys.result.entries())
          initialLocalStorage[key.toString()] = objStore.result[i];
        res([initialLocalStorage, db2]);
      };
      tx.onabort = () => {
        var _a;
        rej("transaction aborted: " + ((_a = tx.error) == null ? void 0 : _a.toString()));
      };
    });
    dbOpenRequest.addEventListener("upgradeneeded", () => {
      const db2 = dbOpenRequest.result;
      db2.createObjectStore(docId);
    });
    dbOpenRequest.addEventListener("blocked", () => {
      rej("Open request was blocked");
    });
    dbOpenRequest.addEventListener("error", () => {
      rej(dbOpenRequest.error);
    });
  });
  let childInitedRes;
  const childInitialized = new Promise((r) => {
    childInitedRes = r;
  });
  port.onmessage = async (event) => {
    const objStore = db.transaction(docId, "readwrite").objectStore(docId);
    switch (event.data.call) {
      case "setItem":
        localStorage.setItem(
          `localStorage:${docId}:${encodeURIComponent(
            event.data.key
          )}`,
          event.data.value
        );
        objStore.put(event.data.value, event.data.key);
        break;
      case "removeItem":
        localStorage.removeItem(
          `localStorage:${docId}:${encodeURIComponent(
            event.data.key
          )}`
        );
        objStore.delete(event.data.key);
        break;
      case "initialized":
        childInitedRes();
    }
  };
  port.postMessage({ call: "init", initialStore });
  console.log("Posted init message");
  window2.addEventListener("storage", (event) => {
    if (event.key == null) {
      port.postMessage({
        key: null,
        oldValue: event.oldValue,
        newValue: event.newValue
      });
      return;
    }
    const [ls, dId, encodedKey] = event.key.split(":");
    if (ls != "localStorage") return;
    if (dId != docId) return;
    const key = decodeURIComponent(encodedKey);
    port.postMessage({
      call: "storageEvent",
      key,
      oldValue: event.oldValue,
      newValue: event.newValue
    });
  });
  await childInitialized;
}
function deserializeQuery$1(range) {
  if (typeof range === "object" && "lower" in range) {
    const { lower, upper, lowerOpen, upperOpen } = range;
    if (lower === void 0 && upper === void 0) return void 0;
    if (lower === void 0) {
      return IDBKeyRange.upperBound(upper, upperOpen);
    }
    if (upper === void 0) {
      return IDBKeyRange.lowerBound(lower, lowerOpen);
    }
    return IDBKeyRange.bound(lower, upper, lowerOpen, upperOpen);
  }
  return range;
}
function serializeQuery(range) {
  if (range === void 0)
    return void 0;
  if (typeof range === "object" && range instanceof FDBKeyRange) {
    return {
      lower: range.lower,
      upper: range.upper,
      lowerOpen: range.lowerOpen,
      upperOpen: range.upperOpen
    };
  }
  return range;
}
const messages = {
  AbortError: "A request was aborted, for example through a call to IDBTransaction.abort.",
  ConstraintError: "A mutation operation in the transaction failed because a constraint was not satisfied. For example, an object such as an object store or index already exists and a request attempted to create a new one.",
  DataError: "Data provided to an operation does not meet requirements.",
  InvalidAccessError: "An invalid operation was performed on an object. For example transaction creation attempt was made, but an empty scope was provided.",
  InvalidStateError: "An operation was called on an object on which it is not allowed or at a time when it is not allowed. Also occurs if a request is made on a source object that has been deleted or removed. Use TransactionInactiveError or ReadOnlyError when possible, as they are more specific variations of InvalidStateError.",
  NotFoundError: "The operation failed because the requested database object could not be found. For example, an object store did not exist but was being opened.",
  ReadOnlyError: 'The mutating operation was attempted in a "readonly" transaction.',
  TransactionInactiveError: "A request was placed against a transaction which is currently not active, or which is finished.",
  VersionError: "An attempt was made to open a database using a lower version than the existing version."
};
class AbortError extends DOMException {
  constructor(message = messages.AbortError) {
    super(message, "AbortError");
  }
}
class ConstraintError extends DOMException {
  constructor(message = messages.ConstraintError) {
    super(message, "ConstraintError");
  }
}
class DataError extends DOMException {
  constructor(message = messages.DataError) {
    super(message, "DataError");
  }
}
class InvalidAccessError extends DOMException {
  constructor(message = messages.InvalidAccessError) {
    super(message, "InvalidAccessError");
  }
}
class InvalidStateError extends DOMException {
  constructor(message = messages.InvalidStateError) {
    super(message, "InvalidStateError");
  }
}
class NotFoundError extends DOMException {
  constructor(message = messages.NotFoundError) {
    super(message, "NotFoundError");
  }
}
class ReadOnlyError extends DOMException {
  constructor(message = messages.ReadOnlyError) {
    super(message, "ReadOnlyError");
  }
}
class TransactionInactiveError extends DOMException {
  constructor(message = messages.TransactionInactiveError) {
    super(message, "TransactionInactiveError");
  }
}
class VersionError extends DOMException {
  constructor(message = messages.VersionError) {
    super(message, "VersionError");
  }
}
const valueToKey = (input, seen) => {
  if (typeof input === "number") {
    if (isNaN(input)) {
      throw new DataError();
    }
    return input;
  } else if (Object.prototype.toString.call(input) === "[object Date]") {
    const ms = input.valueOf();
    if (isNaN(ms)) {
      throw new DataError();
    }
    return new Date(ms);
  } else if (typeof input === "string") {
    return input;
  } else if (input instanceof ArrayBuffer || typeof SharedArrayBuffer !== "undefined" && input instanceof SharedArrayBuffer || typeof ArrayBuffer !== "undefined" && ArrayBuffer.isView && ArrayBuffer.isView(input)) {
    if (
      // detached is new as of es2024
      "detached" in input && input.detached
    ) {
      throw new DataError();
    }
    if ("buffer" in input && "detached" in input.buffer && input.buffer.detached) {
      throw new DataError();
    }
    let arrayBuffer;
    let offset = 0;
    let length = 0;
    if (input instanceof ArrayBuffer || typeof SharedArrayBuffer !== "undefined" && input instanceof SharedArrayBuffer) {
      arrayBuffer = input;
      length = input.byteLength;
    } else {
      const view = input;
      arrayBuffer = view.buffer;
      offset = view.byteOffset;
      length = view.byteLength;
    }
    if ("detached" in arrayBuffer && arrayBuffer.detached) {
      return new ArrayBuffer(0);
    }
    return arrayBuffer.slice(
      offset,
      offset + length
    );
  } else if (Array.isArray(input)) {
    if (seen === void 0) {
      seen = /* @__PURE__ */ new Set();
    } else if (seen.has(input)) {
      throw new DataError();
    }
    seen.add(input);
    const keys = [];
    for (let i = 0; i < input.length; i++) {
      const hop = Object.hasOwn(input, i);
      if (!hop) {
        throw new DataError();
      }
      const entry = input[i];
      const key = valueToKey(entry, seen);
      keys.push(key);
    }
    return keys;
  } else {
    throw new DataError();
  }
};
const getType = (x) => {
  if (typeof x === "number") {
    return "Number";
  }
  if (Object.prototype.toString.call(x) === "[object Date]") {
    return "Date";
  }
  if (Array.isArray(x)) {
    return "Array";
  }
  if (typeof x === "string") {
    return "String";
  }
  if (x instanceof ArrayBuffer) {
    return "Binary";
  }
  throw new DataError();
};
const cmp = (first, second) => {
  if (second === void 0) {
    throw new TypeError();
  }
  first = valueToKey(first);
  second = valueToKey(second);
  const t1 = getType(first);
  const t2 = getType(second);
  if (t1 !== t2) {
    if (t1 === "Array") {
      return 1;
    }
    if (t1 === "Binary" && (t2 === "String" || t2 === "Date" || t2 === "Number")) {
      return 1;
    }
    if (t1 === "String" && (t2 === "Date" || t2 === "Number")) {
      return 1;
    }
    if (t1 === "Date" && t2 === "Number") {
      return 1;
    }
    return -1;
  }
  if (t1 === "Binary") {
    first = new Uint8Array(first);
    second = new Uint8Array(second);
  }
  if (t1 === "Array" || t1 === "Binary") {
    const length = Math.min(first.length, second.length);
    for (let i = 0; i < length; i++) {
      const result = cmp(first[i], second[i]);
      if (result !== 0) {
        return result;
      }
    }
    if (first.length > second.length) {
      return 1;
    }
    if (first.length < second.length) {
      return -1;
    }
    return 0;
  }
  if (t1 === "Date") {
    if (first.getTime() === second.getTime()) {
      return 0;
    }
  } else {
    if (first === second) {
      return 0;
    }
  }
  return first > second ? 1 : -1;
};
const extractKey = (keyPath, value) => {
  if (Array.isArray(keyPath)) {
    const result = [];
    for (let item of keyPath) {
      if (item !== void 0 && item !== null && typeof item !== "string" && item.toString) {
        item = item.toString();
      }
      const key = extractKey(item, value).key;
      result.push(valueToKey(key));
    }
    return { type: "found", key: result };
  }
  if (keyPath === "") {
    return { type: "found", key: value };
  }
  let remainingKeyPath = keyPath;
  let object = value;
  while (remainingKeyPath !== null) {
    let identifier;
    const i = remainingKeyPath.indexOf(".");
    if (i >= 0) {
      identifier = remainingKeyPath.slice(0, i);
      remainingKeyPath = remainingKeyPath.slice(i + 1);
    } else {
      identifier = remainingKeyPath;
      remainingKeyPath = null;
    }
    if (object === void 0 || object === null || object[identifier] === void 0) {
      return { type: "notFound" };
    }
    object = object[identifier];
  }
  return { type: "found", key: object };
};
const getEffectiveObjectStore = (cursor) => {
  if (cursor.source instanceof FDBObjectStore) {
    return cursor.source;
  }
  return cursor.source.objectStore;
};
const makeKeyRange = (range, lowers, uppers) => {
  let [lower, upper] = typeof range === "object" && "lower" in range ? [range == null ? void 0 : range.lower, range == null ? void 0 : range.upper] : [void 0, void 0];
  for (const lowerTemp of lowers) {
    if (lowerTemp === void 0) {
      continue;
    }
    if (lower === void 0 || cmp(lower, lowerTemp) === -1) {
      lower = lowerTemp;
    }
  }
  for (const upperTemp of uppers) {
    if (upperTemp === void 0) {
      continue;
    }
    if (upper === void 0 || cmp(upper, upperTemp) === 1) {
      upper = upperTemp;
    }
  }
  if (lower !== void 0 && upper !== void 0) {
    return FDBKeyRange.bound(lower, upper);
  }
  if (lower !== void 0) {
    return FDBKeyRange.lowerBound(lower);
  }
  if (upper !== void 0) {
    return FDBKeyRange.upperBound(upper);
  }
};
class FDBCursor {
  constructor(source, range, direction = "next", request) {
    __publicField(this, "_request");
    __publicField(this, "_gotValue", false);
    __publicField(this, "_range");
    __publicField(this, "_position");
    // Key of previously returned record
    __publicField(this, "_objectStorePosition");
    __publicField(this, "_source");
    __publicField(this, "_direction");
    __publicField(this, "_key");
    __publicField(this, "_primaryKey");
    __publicField(this, "_previousFetchedPrimaryKey");
    __publicField(this, "_previousFetchedKey");
    this._range = range;
    this._source = source;
    this._direction = direction;
    this._request = request;
  }
  // Read only properties
  get source() {
    return this._source;
  }
  set source(_val) {
  }
  get request() {
    return this._request;
  }
  set request(_val) {
  }
  get direction() {
    return this._direction;
  }
  set direction(_val) {
  }
  get key() {
    return this._key;
  }
  set key(_val) {
  }
  get primaryKey() {
    return this._primaryKey;
  }
  set primaryKey(_val) {
  }
  // https://w3c.github.io/IndexedDB/#iterate-a-cursor
  async _iterate(key, primaryKey) {
    var _a, _b, _c, _d;
    const sourceIsObjectStore = this.source instanceof FDBObjectStore;
    const records = this.source instanceof FDBObjectStore ? this.source._rawObjectStore.records : this.source._rawIndex.records;
    const objectStore = this.source instanceof FDBIndex ? this.source._rawIndex.rawObjectStore : this.source._rawObjectStore;
    const storeName = objectStore.name;
    const port = objectStore.rawDatabase._port;
    let foundRecord;
    const isNext = this.direction.includes("next");
    const isUnique = this.direction.includes("unique");
    let range;
    const keyIntoRange = key === void 0 && (sourceIsObjectStore || isUnique) ? this._previousFetchedKey : key;
    try {
      range = makeKeyRange(
        this._range,
        isNext ? [keyIntoRange, this._position] : [],
        isNext ? [] : [key, this._position]
      );
    } catch {
      return null;
    }
    if (range && ((_a = this._range) == null ? void 0 : _a.lowerOpen) && ((_b = this._range) == null ? void 0 : _b.lower) === (range == null ? void 0 : range.lower)) {
      range.lowerOpen = true;
    }
    if (range && ((_c = this._range) == null ? void 0 : _c.upperOpen) && ((_d = this._range) == null ? void 0 : _d.lower) === (range == null ? void 0 : range.lower)) {
      range.upperOpen = true;
    }
    if ((isUnique || sourceIsObjectStore) && range && isNext && key === void 0 && primaryKey === void 0 && this._previousFetchedKey !== void 0) {
      if (range.lower && range.upper && cmp(range.lower, range.upper) === 0) {
        return null;
      }
      range.lowerOpen = true;
    }
    if ((isUnique || sourceIsObjectStore) && range && !isNext && key === void 0 && primaryKey === void 0 && this._previousFetchedKey !== void 0) {
      if (range.lower && range.upper && cmp(range.lower, range.upper) === 0) {
        return null;
      }
      range.upperOpen = true;
    }
    let fetchedNextPromise = null;
    let tmpRange = range;
    while (fetchedNextPromise !== void 0 && (fetchedNextPromise === null || getEffectiveObjectStore(this)._rawObjectStore.records.modified(
      fetchedNextPromise.key
    ))) {
      if (fetchedNextPromise !== null && sourceIsObjectStore) {
        try {
          tmpRange = makeKeyRange(
            this._range,
            isNext ? [key, fetchedNextPromise.primaryKey] : [],
            isNext ? [] : [key, fetchedNextPromise.primaryKey]
          );
          if (tmpRange && isNext) {
            tmpRange.lowerOpen = true;
          } else if (tmpRange && !isNext) {
            tmpRange.upperOpen = true;
          }
        } catch {
          return null;
        }
      }
      let prevPrimaryKey = void 0;
      if (!sourceIsObjectStore) {
        if (fetchedNextPromise) {
          prevPrimaryKey = fetchedNextPromise.primaryKey;
        } else if (tmpRange && this._previousFetchedKey && tmpRange.includes(this._previousFetchedKey)) {
          prevPrimaryKey = this._previousFetchedPrimaryKey;
        }
      }
      fetchedNextPromise = await call(
        port,
        "executeRead",
        {
          dbName: objectStore.rawDatabase.name,
          store: storeName,
          call: {
            method: "getNextFromCursor",
            params: {
              justKeys: !(this instanceof FDBCursorWithValue),
              range: serializeQuery(tmpRange),
              direction: this.direction,
              currPrimaryKey: primaryKey,
              prevPrimaryKey,
              indexName: sourceIsObjectStore ? void 0 : this.source.name
            }
          }
        }
      );
    }
    const iterationDirection = isNext ? void 0 : "prev";
    let tempRecord;
    for (const record of records.values(range, iterationDirection)) {
      const cmpResultKey = key !== void 0 ? cmp(record.key, key) : void 0;
      const cmpResultPosition = this._position !== void 0 ? cmp(record.key, this._position) : void 0;
      if (key !== void 0) {
        if (isNext && cmpResultKey === -1 || !isNext && cmpResultKey === 1) {
          continue;
        }
      }
      if (primaryKey !== void 0) {
        if (isNext && cmpResultKey === -1 || !isNext && cmpResultKey === 1) {
          continue;
        }
        const cmpResultPrimaryKey = cmp(record.value, primaryKey);
        if (cmpResultKey === 0) {
          if (isNext && cmpResultPrimaryKey === -1 || !isNext && cmpResultPrimaryKey === 1) {
            continue;
          }
        }
      }
      if (this._position !== void 0) {
        if (sourceIsObjectStore) {
          if (isNext && cmpResultPosition !== 1 || !isNext && cmpResultPosition !== -1) {
            continue;
          }
        } else {
          if (isNext && cmpResultPosition === -1 || !isNext && cmpResultPosition === 1) {
            continue;
          }
          if (cmpResultPosition === 0) {
            const objStoreCmp = cmp(
              record.value,
              this._objectStorePosition
            );
            if (isNext && objStoreCmp !== 1 || !isNext && objStoreCmp !== -1) {
              continue;
            }
          }
        }
      }
      if (isUnique && this._position !== void 0) {
        const expectedCmp = isNext ? 1 : -1;
        if (cmpResultPosition !== expectedCmp) {
          continue;
        }
      }
      if (this._range !== void 0 && !this._range.includes(record.key)) {
        continue;
      }
      tempRecord = record;
      break;
    }
    if (this.direction === "prevunique" && tempRecord) {
      foundRecord = records.get(tempRecord.key);
    } else {
      foundRecord = tempRecord;
    }
    const fetchedNext = fetchedNextPromise;
    const convertedFetchedNext = fetchedNext && (sourceIsObjectStore ? { key: fetchedNext.key, value: fetchedNext.value } : { key: fetchedNext.key, value: fetchedNext.primaryKey });
    if (foundRecord && fetchedNext) {
      const cmpResult = cmp(
        sourceIsObjectStore ? foundRecord.key : [foundRecord.key, foundRecord.value],
        sourceIsObjectStore ? fetchedNext.key : [fetchedNext.key, fetchedNext.primaryKey]
      );
      if (isNext) {
        if (cmpResult > 0) {
          foundRecord = convertedFetchedNext;
        } else {
          const foundPrimaryKey = sourceIsObjectStore ? foundRecord.key : foundRecord.value;
          const fetchedPrimaryKey = fetchedNext.primaryKey;
          if (cmp(foundPrimaryKey, fetchedPrimaryKey) > 0) {
            foundRecord = convertedFetchedNext;
          }
        }
      } else {
        if (cmpResult < 0) {
          foundRecord = convertedFetchedNext;
        } else {
          const foundPrimaryKey = sourceIsObjectStore ? foundRecord.key : foundRecord.value;
          const fetchedPrimaryKey = fetchedNext.primaryKey;
          if (cmp(foundPrimaryKey, fetchedPrimaryKey) < 0) {
            foundRecord = convertedFetchedNext;
          }
        }
      }
    } else if (fetchedNext) {
      foundRecord = convertedFetchedNext;
    }
    const fetchedChosen = convertedFetchedNext === foundRecord;
    if (foundRecord !== void 0 && fetchedChosen) {
      this._previousFetchedPrimaryKey = fetchedNext.primaryKey;
      this._previousFetchedKey = fetchedNext.key;
    }
    let result;
    if (!foundRecord) {
      this._key = void 0;
      if (!sourceIsObjectStore) {
        this._objectStorePosition = void 0;
      }
      if (this instanceof FDBCursorWithValue) {
        this.value = void 0;
      }
      result = null;
    } else {
      this._position = foundRecord.key;
      if (!sourceIsObjectStore) {
        this._objectStorePosition = foundRecord.value;
      }
      this._key = foundRecord.key;
      if (sourceIsObjectStore) {
        this._primaryKey = structuredClone(foundRecord.key);
        if (this instanceof FDBCursorWithValue) {
          this.value = structuredClone(foundRecord.value);
        }
      } else {
        this._primaryKey = structuredClone(foundRecord.value);
        if (this instanceof FDBCursorWithValue) {
          if (this.source instanceof FDBObjectStore) {
            throw new Error("This should never happen");
          }
          const value = await this.source.objectStore._rawObjectStore.getValue(
            foundRecord.value
          );
          this.value = structuredClone(value);
        }
      }
      this._gotValue = true;
      result = this;
    }
    return result;
  }
  // http://www.w3.org/TR/2015/REC-IndexedDB-20150108/#widl-IDBCursor-update-IDBRequest-any-value
  update(value) {
    if (value === void 0) {
      throw new TypeError();
    }
    const effectiveObjectStore = getEffectiveObjectStore(this);
    const effectiveKey = Object.hasOwn(this.source, "_rawIndex") ? this.primaryKey : this._position;
    const transaction = effectiveObjectStore.transaction;
    if (transaction._state !== "active") {
      throw new TransactionInactiveError();
    }
    if (transaction.mode === "readonly") {
      throw new ReadOnlyError();
    }
    if (effectiveObjectStore._rawObjectStore.deleted) {
      throw new InvalidStateError();
    }
    if (!(this.source instanceof FDBObjectStore) && this.source._rawIndex.deleted) {
      throw new InvalidStateError();
    }
    if (!this._gotValue || !Object.hasOwn(this, "value")) {
      throw new InvalidStateError();
    }
    let clone;
    try {
      clone = structuredClone(value);
    } catch {
      throw new DataError();
    }
    if (effectiveObjectStore.keyPath !== null) {
      let tempKey;
      try {
        tempKey = extractKey(effectiveObjectStore.keyPath, clone).key;
      } catch {
      }
      if (cmp(tempKey, effectiveKey) !== 0) {
        throw new DataError();
      }
    }
    const record = {
      key: effectiveKey,
      value: clone
    };
    effectiveObjectStore._updateWriteLog.push({
      method: "put",
      params: {
        value: record.value,
        key: effectiveObjectStore.keyPath === null ? record.key : void 0
      }
    });
    return transaction._execRequestAsync({
      operation: effectiveObjectStore._rawObjectStore.storeRecord.bind(
        effectiveObjectStore._rawObjectStore,
        record,
        false,
        transaction._rollbackLog
      ),
      source: this
    });
  }
  // http://www.w3.org/TR/2015/REC-IndexedDB-20150108/#widl-IDBCursor-advance-void-unsigned-long-count
  advance(count) {
    if (!Number.isInteger(count) || count <= 0) {
      throw new TypeError();
    }
    const effectiveObjectStore = getEffectiveObjectStore(this);
    const transaction = effectiveObjectStore.transaction;
    if (transaction._state !== "active") {
      throw new TransactionInactiveError();
    }
    if (effectiveObjectStore._rawObjectStore.deleted) {
      throw new InvalidStateError();
    }
    if (!(this.source instanceof FDBObjectStore) && this.source._rawIndex.deleted) {
      throw new InvalidStateError();
    }
    if (!this._gotValue) {
      throw new InvalidStateError();
    }
    if (this._request) {
      this._request.readyState = "pending";
    }
    transaction._execRequestAsync({
      operation: async () => {
        let result;
        for (let i = 0; i < count; i++) {
          result = await this._iterate();
          if (!result) {
            break;
          }
        }
        return result;
      },
      request: this._request,
      source: this.source
    });
    this._gotValue = false;
  }
  // http://www.w3.org/TR/2015/REC-IndexedDB-20150108/#widl-IDBCursor-continue-void-any-key
  continue(key) {
    const effectiveObjectStore = getEffectiveObjectStore(this);
    const transaction = effectiveObjectStore.transaction;
    if (transaction._state !== "active") {
      throw new TransactionInactiveError();
    }
    if (effectiveObjectStore._rawObjectStore.deleted) {
      throw new InvalidStateError();
    }
    if (!(this.source instanceof FDBObjectStore) && this.source._rawIndex.deleted) {
      throw new InvalidStateError();
    }
    if (!this._gotValue) {
      throw new InvalidStateError();
    }
    if (key !== void 0) {
      key = valueToKey(key);
      const cmpResult = cmp(key, this._position);
      if (cmpResult <= 0 && (this.direction === "next" || this.direction === "nextunique") || cmpResult >= 0 && (this.direction === "prev" || this.direction === "prevunique")) {
        throw new DataError();
      }
    }
    if (this._request) {
      this._request.readyState = "pending";
    }
    transaction._execRequestAsync({
      operation: this._iterate.bind(this, key),
      request: this._request,
      source: this.source
    });
    this._gotValue = false;
  }
  // hthttps://w3c.github.io/IndexedDB/#dom-idbcursor-continueprimarykey
  continuePrimaryKey(key, primaryKey) {
    const effectiveObjectStore = getEffectiveObjectStore(this);
    const transaction = effectiveObjectStore.transaction;
    if (transaction._state !== "active") {
      throw new TransactionInactiveError();
    }
    if (effectiveObjectStore._rawObjectStore.deleted) {
      throw new InvalidStateError();
    }
    if (!(this.source instanceof FDBObjectStore) && this.source._rawIndex.deleted) {
      throw new InvalidStateError();
    }
    if (this.source instanceof FDBObjectStore || this.direction !== "next" && this.direction !== "prev") {
      throw new InvalidAccessError();
    }
    if (!this._gotValue) {
      throw new InvalidStateError();
    }
    if (key === void 0 || primaryKey === void 0) {
      throw new DataError();
    }
    key = valueToKey(key);
    const cmpResult = cmp(key, this._position);
    if (cmpResult === -1 && this.direction === "next" || cmpResult === 1 && this.direction === "prev") {
      throw new DataError();
    }
    const cmpResult2 = cmp(primaryKey, this._objectStorePosition);
    if (cmpResult === 0) {
      if (cmpResult2 <= 0 && this.direction === "next" || cmpResult2 >= 0 && this.direction === "prev") {
        throw new DataError();
      }
    }
    if (this._request) {
      this._request.readyState = "pending";
    }
    transaction._execRequestAsync({
      operation: this._iterate.bind(this, key, primaryKey),
      request: this._request,
      source: this.source
    });
    this._gotValue = false;
  }
  delete() {
    const effectiveObjectStore = getEffectiveObjectStore(this);
    const effectiveKey = Object.hasOwn(this.source, "_rawIndex") ? this.primaryKey : this._position;
    const transaction = effectiveObjectStore.transaction;
    if (transaction._state !== "active") {
      throw new TransactionInactiveError();
    }
    if (transaction.mode === "readonly") {
      throw new ReadOnlyError();
    }
    if (effectiveObjectStore._rawObjectStore.deleted) {
      throw new InvalidStateError();
    }
    if (!(this.source instanceof FDBObjectStore) && this.source._rawIndex.deleted) {
      throw new InvalidStateError();
    }
    if (!this._gotValue || !Object.hasOwn(this, "value")) {
      throw new InvalidStateError();
    }
    effectiveObjectStore._updateWriteLog.push({
      method: "delete",
      params: {
        query: effectiveKey
      }
    });
    return transaction._execRequestAsync({
      operation: effectiveObjectStore._rawObjectStore.deleteRecord.bind(
        effectiveObjectStore._rawObjectStore,
        effectiveKey,
        transaction._rollbackLog
      ),
      source: this
    });
  }
  toString() {
    return "[object IDBCursor]";
  }
}
class FDBCursorWithValue extends FDBCursor {
  constructor(source, range, direction, request) {
    super(source, range, direction, request);
    __publicField(this, "value");
  }
  toString() {
    return "[object IDBCursorWithValue]";
  }
}
class FDBKeyRange {
  constructor(lower, upper, lowerOpen, upperOpen) {
    __publicField(this, "lower");
    __publicField(this, "upper");
    __publicField(this, "lowerOpen");
    __publicField(this, "upperOpen");
    this.lower = lower;
    this.upper = upper;
    this.lowerOpen = lowerOpen;
    this.upperOpen = upperOpen;
  }
  static only(value) {
    if (arguments.length === 0) {
      throw new TypeError();
    }
    value = valueToKey(value);
    return new FDBKeyRange(value, value, false, false);
  }
  static lowerBound(lower, open = false) {
    if (arguments.length === 0) {
      throw new TypeError();
    }
    lower = valueToKey(lower);
    return new FDBKeyRange(lower, void 0, open, true);
  }
  static upperBound(upper, open = false) {
    if (arguments.length === 0) {
      throw new TypeError();
    }
    upper = valueToKey(upper);
    return new FDBKeyRange(void 0, upper, true, open);
  }
  static bound(lower, upper, lowerOpen = false, upperOpen = false) {
    if (arguments.length < 2) {
      throw new TypeError();
    }
    const cmpResult = cmp(lower, upper);
    if (cmpResult === 1 || cmpResult === 0 && (lowerOpen || upperOpen)) {
      throw new DataError();
    }
    lower = valueToKey(lower);
    upper = valueToKey(upper);
    return new FDBKeyRange(lower, upper, lowerOpen, upperOpen);
  }
  // https://w3c.github.io/IndexedDB/#dom-idbkeyrange-includes
  includes(key) {
    if (arguments.length === 0) {
      throw new TypeError();
    }
    key = valueToKey(key);
    if (this.lower !== void 0) {
      const cmpResult = cmp(this.lower, key);
      if (cmpResult === 1 || cmpResult === 0 && this.lowerOpen) {
        return false;
      }
    }
    if (this.upper !== void 0) {
      const cmpResult = cmp(this.upper, key);
      if (cmpResult === -1 || cmpResult === 0 && this.upperOpen) {
        return false;
      }
    }
    return true;
  }
  toString() {
    return "[object IDBKeyRange]";
  }
}
const canInjectKey = (keyPath, value) => {
  if (Array.isArray(keyPath)) {
    throw new Error(
      "The key paths used in this section are always strings and never sequences, since it is not possible to create a object store which has a key generator and also has a key path that is a sequence."
    );
  }
  const identifiers = keyPath.split(".");
  if (identifiers.length === 0) {
    throw new Error("Assert: identifiers is not empty");
  }
  identifiers.pop();
  for (const identifier of identifiers) {
    if (typeof value !== "object" && !Array.isArray(value)) {
      return false;
    }
    const hop = Object.hasOwn(value, identifier);
    if (!hop) {
      return true;
    }
    value = value[identifier];
  }
  return typeof value === "object" || Array.isArray(value);
};
const enforceRange = (num, type) => {
  const min = 0;
  const max = type === "unsigned long" ? 4294967295 : 9007199254740991;
  if (isNaN(num) || num < min || num > max) {
    throw new TypeError();
  }
  if (num >= 0) {
    return Math.floor(num);
  }
};
class FakeDOMStringList {
  constructor(...values) {
    __publicField(this, "_values");
    this._values = values;
    for (let i = 0; i < values.length; i++) {
      this[i] = values[i];
    }
  }
  contains(value) {
    return this._values.includes(value);
  }
  item(i) {
    if (i < 0 || i >= this._values.length) {
      return null;
    }
    return this._values[i];
  }
  get length() {
    return this._values.length;
  }
  [Symbol.iterator]() {
    return this._values[Symbol.iterator]();
  }
  // Used internally, should not be used by others. I could maybe get rid of these and replace rather than mutate, but too lazy to check the spec.
  _push(...values) {
    for (let i = 0; i < values.length; i++) {
      this[this._values.length + i] = values[i];
    }
    this._values.push(...values);
  }
  _sort(...values) {
    this._values.sort(...values);
    for (let i = 0; i < this._values.length; i++) {
      this[i] = this._values[i];
    }
    return this;
  }
}
function getSetImmediateFromJsdom() {
  if (typeof navigator !== "undefined" && /jsdom/.test(navigator.userAgent)) {
    const outerRealmFunctionConstructor = Node.constructor;
    return new outerRealmFunctionConstructor("return setImmediate")();
  } else {
    return void 0;
  }
}
const queueTask = (fn) => {
  const setImmediate = globalThis.setImmediate || getSetImmediateFromJsdom() || ((fn2) => setTimeout(fn2, 0));
  setImmediate(fn);
};
class Database {
  constructor(name, version, port) {
    __publicField(this, "deletePending", false);
    __publicField(this, "transactions", []);
    __publicField(this, "rawObjectStores", /* @__PURE__ */ new Map());
    __publicField(this, "connections", []);
    __publicField(this, "name");
    __publicField(this, "version");
    __publicField(this, "_port");
    this.name = name;
    this.version = version;
    this._port = port;
    this.processTransactions = this.processTransactions.bind(this);
  }
  async sync() {
    this.rawObjectStores.clear();
    for (const objectStore of (await call(
      this._port,
      "getDatabaseStores",
      {
        name: this.name
      }
    )).map(({ name, parameters, indexes }) => {
      const os = new ObjectStore(
        this,
        name,
        parameters.keyPath ?? null,
        !!parameters.autoIncrement
      );
      for (const index of indexes) {
        const newIndex = new Index(
          os,
          index.name,
          index.keyPath,
          index.multiEntry,
          index.unique
        );
        os.rawIndexes.set(index.name, newIndex);
      }
      return os;
    })) {
      this.rawObjectStores.set(objectStore.name, objectStore);
    }
  }
  processTransactions() {
    queueTask(() => {
      const anyRunning = this.transactions.some((transaction) => {
        return transaction._started && transaction._state !== "finished";
      });
      if (!anyRunning) {
        const next = this.transactions.find((transaction) => {
          return !transaction._started && transaction._state !== "finished";
        });
        if (next) {
          next.addEventListener("complete", this.processTransactions);
          next.addEventListener("abort", this.processTransactions);
          next._start();
        }
      }
    });
  }
}
const MAX_KEY = 9007199254740992;
class KeyGenerator {
  constructor() {
    // This is kind of wrong. Should start at 1 and increment only after record is saved
    __publicField(this, "num", 0);
  }
  next() {
    if (this.num >= MAX_KEY) {
      throw new ConstraintError();
    }
    this.num += 1;
    return this.num;
  }
  // https://w3c.github.io/IndexedDB/#possibly-update-the-key-generator
  setIfLarger(num) {
    const value = Math.floor(Math.min(num, MAX_KEY)) - 1;
    if (value >= this.num) {
      this.num = value + 1;
    }
  }
}
function binarySearch(records, key) {
  let low = 0;
  let high = records.length;
  let mid;
  while (low < high) {
    mid = low + high >>> 1;
    if (cmp(records[mid].key, key) < 0) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }
  return low;
}
function getIndexByKey(records, key) {
  const idx = binarySearch(records, key);
  const record = records[idx];
  if (record && cmp(record.key, key) === 0) {
    return idx;
  }
  return -1;
}
function getByKey(records, key) {
  const idx = getIndexByKey(records, key);
  return records[idx];
}
function getIndexByKeyRange(records, keyRange) {
  const lowerIdx = typeof keyRange.lower === "undefined" ? 0 : binarySearch(records, keyRange.lower);
  const upperIdx = typeof keyRange.upper === "undefined" ? records.length - 1 : binarySearch(records, keyRange.upper);
  for (let i = lowerIdx; i <= upperIdx; i++) {
    const record = records[i];
    if (record && keyRange.includes(record.key)) {
      return i;
    }
  }
  return -1;
}
function getByKeyRange(records, keyRange) {
  const idx = getIndexByKeyRange(records, keyRange);
  return records[idx];
}
function getIndexByKeyGTE(records, key) {
  const idx = binarySearch(records, key);
  const record = records[idx];
  if (record && cmp(record.key, key) >= 0) {
    return idx;
  }
  return -1;
}
class RecordStore {
  constructor(isModificationSet = false) {
    __publicField(this, "records", []);
    __publicField(this, "keyModificationSet");
    __publicField(this, "deletedKeyRanges", []);
    if (!isModificationSet) {
      this.keyModificationSet = new RecordStore(true);
    }
  }
  get(key) {
    if (key instanceof FDBKeyRange) {
      return getByKeyRange(this.records, key);
    }
    return getByKey(this.records, key);
  }
  // do at either abort or complete of transaction
  cleanupAfterCompletedTransaction() {
    this.keyModificationSet.clear(false);
    this.records = [];
    this.deletedKeyRanges = [];
  }
  // set operation works by a delete followed by an add so we only need to
  // call this function internally within the set and delete operations
  addToModifications(record) {
    const r = { key: structuredClone(record.key), value: void 0 };
    this.keyModificationSet.set(r);
  }
  modified(key) {
    if (this.keyModificationSet.get(key) !== void 0) {
      return true;
    }
    for (const keyRange of this.deletedKeyRanges) {
      if (keyRange.includes(key)) {
        return true;
      }
    }
    return false;
  }
  add(newRecord) {
    let i;
    if (this.records.length === 0) {
      i = 0;
    } else {
      i = getIndexByKeyGTE(this.records, newRecord.key);
      if (i === -1) {
        i = this.records.length;
      } else {
        while (i < this.records.length && cmp(this.records[i].key, newRecord.key) === 0) {
          if (cmp(this.records[i].value, newRecord.value) !== -1) {
            break;
          }
          i += 1;
        }
      }
    }
    this.addToModifications(newRecord);
    this.records.splice(i, 0, newRecord);
  }
  // only used in addToModifications
  set(newRecord) {
    let i;
    if (this.records.length === 0) {
      i = 0;
    } else {
      i = getIndexByKeyGTE(this.records, newRecord.key);
      if (i === -1) {
        i = this.records.length;
      } else {
        if (cmp(this.records[i].key, newRecord.key) === 0) {
          this.records[i].value = newRecord.value;
          return;
        }
      }
    }
    this.records.splice(i, 0, newRecord);
  }
  delete(key) {
    const deletedRecords = [];
    const isRange = key instanceof FDBKeyRange;
    this.deletedKeyRanges.push(isRange ? key : FDBKeyRange.only(key));
    while (true) {
      const idx = isRange ? getIndexByKeyRange(this.records, key) : getIndexByKey(this.records, key);
      if (idx === -1) {
        break;
      }
      deletedRecords.push(this.records[idx]);
      this.records.splice(idx, 1);
    }
    for (const record of deletedRecords) {
      this.addToModifications(record);
    }
    return deletedRecords;
  }
  deleteByValue(key) {
    const range = key instanceof FDBKeyRange ? key : FDBKeyRange.only(key);
    const deletedRecords = [];
    this.records = this.records.filter((record) => {
      const shouldDelete = range.includes(record.value);
      if (shouldDelete) {
        deletedRecords.push(record);
      }
      return !shouldDelete;
    });
    return deletedRecords;
  }
  clear(recordTombstones = true) {
    const deletedRecords = this.records.slice();
    this.records = [];
    if (recordTombstones) {
      for (const record of deletedRecords) {
        this.addToModifications(record);
      }
    }
    return deletedRecords;
  }
  values(range, direction = "next") {
    return {
      [Symbol.iterator]: () => {
        let i;
        if (direction === "next") {
          i = 0;
          if (range !== void 0 && range.lower !== void 0) {
            while (this.records[i] !== void 0) {
              const cmpResult = cmp(
                this.records[i].key,
                range.lower
              );
              if (cmpResult === 1 || cmpResult === 0 && !range.lowerOpen) {
                break;
              }
              i += 1;
            }
          }
        } else {
          i = this.records.length - 1;
          if (range !== void 0 && range.upper !== void 0) {
            while (this.records[i] !== void 0) {
              const cmpResult = cmp(
                this.records[i].key,
                range.upper
              );
              if (cmpResult === -1 || cmpResult === 0 && !range.upperOpen) {
                break;
              }
              i -= 1;
            }
          }
        }
        return {
          next: () => {
            let done;
            let value;
            if (direction === "next") {
              value = this.records[i];
              done = i >= this.records.length;
              i += 1;
              if (!done && range !== void 0 && range.upper !== void 0) {
                const cmpResult = cmp(value.key, range.upper);
                done = cmpResult === 1 || cmpResult === 0 && range.upperOpen;
                if (done) {
                  value = void 0;
                }
              }
            } else {
              value = this.records[i];
              done = i < 0;
              i -= 1;
              if (!done && range !== void 0 && range.lower !== void 0) {
                const cmpResult = cmp(value.key, range.lower);
                done = cmpResult === -1 || cmpResult === 0 && range.lowerOpen;
                if (done) {
                  value = void 0;
                }
              }
            }
            return {
              done,
              value
            };
          }
        };
      }
    };
  }
}
class ObjectStore {
  constructor(rawDatabase, name, keyPath, autoIncrement) {
    __publicField(this, "deleted", false);
    __publicField(this, "rawDatabase");
    __publicField(this, "records", new RecordStore());
    __publicField(this, "rawIndexes", /* @__PURE__ */ new Map());
    __privateAdd(this, _oldName);
    __publicField(this, "_name");
    __publicField(this, "keyPath");
    __publicField(this, "autoIncrement");
    __publicField(this, "keyGenerator");
    this.rawDatabase = rawDatabase;
    this.keyGenerator = autoIncrement === true ? new KeyGenerator() : null;
    this.deleted = false;
    this._name = name;
    this.keyPath = keyPath;
    this.autoIncrement = autoIncrement;
  }
  get committedName() {
    return __privateGet(this, _oldName) ?? this.name;
  }
  get name() {
    return this._name;
  }
  set name(v) {
    if (__privateGet(this, _oldName) === void 0) {
      __privateSet(this, _oldName, this._name);
    }
    this._name = v;
  }
  // http://www.w3.org/TR/2015/REC-IndexedDB-20150108/#dfn-steps-for-retrieving-a-value-from-an-object-store
  async getKey(key) {
    let k;
    if (!(key instanceof FDBKeyRange)) {
      k = FDBKeyRange.only(key);
    } else {
      k = key;
    }
    const out = (await this._getAllRecords(k, 1, true)).map((r) => r.key);
    return out[0];
  }
  // http://w3c.github.io/IndexedDB/#retrieve-multiple-keys-from-an-object-store
  async getAllKeys(range, count) {
    return (await this._getAllRecords(range, count, true)).map((r) => r.key);
  }
  cleanupAfterCompletedTransaction() {
    __privateSet(this, _oldName, void 0);
    this.records.cleanupAfterCompletedTransaction();
    for (const index of this.rawIndexes.values()) {
      index.cleanupAfterCompletedTransaction();
    }
  }
  async executeReadMethod(method, params) {
    const readCall = { method, params };
    return await call(this.rawDatabase._port, "executeRead", {
      params: {
        dbName: this.rawDatabase.name,
        store: this.committedName,
        call: readCall
      },
      transferableObjects: []
    });
  }
  // http://www.w3.org/TR/2015/REC-IndexedDB-20150108/#dfn-steps-for-retrieving-a-value-from-an-object-store
  async getValue(key) {
    let k;
    if (!(key instanceof FDBKeyRange)) {
      k = FDBKeyRange.only(key);
    } else {
      k = key;
    }
    const val = (await this._getAllRecords(k, 1)).map((r) => r.value);
    return val.length === 0 ? void 0 : val[0];
  }
  async _getAllRecords(range, count, ignoreValues = false) {
    if (count === void 0 || count === 0) {
      count = Infinity;
    }
    const kvPromise = this.executeReadMethod(ignoreValues ? "getAllKeys" : "getAllRecords", {
      query: range,
      // need to get `count` values for the case that all the cached
      // keys in the range are greater than all fetched keys
      // in the range
      count: Number.isFinite(count) ? count : void 0
    });
    const cachedRecords = [];
    for (const record of this.records.values(range)) {
      cachedRecords.push(structuredClone(record));
      if (cachedRecords.length >= count) {
        break;
      }
    }
    const kvResult = await kvPromise;
    const [values, keys] = ignoreValues ? [kvResult, kvResult] : kvResult;
    const fetchedRecords = keys.map((k, i2) => {
      return {
        key: k,
        value: values[i2]
      };
    }).filter((v) => !this.records.modified(v.key));
    const out = [];
    let i = 0, j = 0;
    while (fetchedRecords.length > i && cachedRecords.length > j && out.length < count) {
      switch (cmp(fetchedRecords[i].key, cachedRecords[j].key)) {
        case -1: {
          out.push(fetchedRecords[i++]);
          break;
        }
        case 1: {
          out.push(cachedRecords[j++]);
          break;
        }
        case 0: {
          out.push(cachedRecords[j++]);
          i++;
        }
      }
    }
    if (out.length === count) {
      return out;
    }
    out.push(...fetchedRecords.slice(i, i + (count - out.length)));
    out.push(...cachedRecords.slice(j, j + (count - out.length)));
    return out;
  }
  // http://w3c.github.io/IndexedDB/#retrieve-multiple-values-from-an-object-store
  // cannot serve from cache because there can always be a value which is
  // somewhere along the range that isn't in the cache
  async getAllValues(range, count) {
    return (await this._getAllRecords(range, count)).map((r) => r.value);
  }
  // http://www.w3.org/TR/2015/REC-IndexedDB-20150108/#dfn-steps-for-storing-a-record-into-an-object-store
  async storeRecord(newRecord, noOverwrite, rollbackLog) {
    if (newRecord.key instanceof ArrayBuffer && // detached is new as of es2024
    "detached" in newRecord.key && newRecord.key.detached) {
      throw new DataError();
    }
    if (this.keyPath !== null) {
      const key = extractKey(this.keyPath, newRecord.value).key;
      if (key !== void 0) {
        newRecord.key = key;
      }
    }
    if (this.keyGenerator !== null && newRecord.key === void 0) {
      if (rollbackLog) {
        const keyGeneratorBefore = this.keyGenerator.num;
        rollbackLog.push(() => {
          if (this.keyGenerator) {
            this.keyGenerator.num = keyGeneratorBefore;
          }
        });
      }
      newRecord.key = this.keyGenerator.next();
      if (this.keyPath !== null) {
        if (Array.isArray(this.keyPath)) {
          throw new Error(
            "Cannot have an array key path in an object store with a key generator"
          );
        }
        let remainingKeyPath = this.keyPath;
        let object = newRecord.value;
        let identifier;
        let i = 0;
        while (i >= 0) {
          if (typeof object !== "object") {
            throw new DataError();
          }
          i = remainingKeyPath.indexOf(".");
          if (i >= 0) {
            identifier = remainingKeyPath.slice(0, i);
            remainingKeyPath = remainingKeyPath.slice(i + 1);
            if (object !== null && !Object.hasOwn(object, identifier)) {
              object[identifier] = {};
            }
            object = object[identifier];
          }
        }
        identifier = remainingKeyPath;
        object[identifier] = newRecord.key;
      }
    } else if (this.keyGenerator !== null && typeof newRecord.key === "number") {
      this.keyGenerator.setIfLarger(newRecord.key);
    }
    let recordExists = this.records.get(newRecord.key) !== void 0;
    if (!recordExists && !this.records.modified(newRecord.key)) {
      const ct = (await call(
        this.rawDatabase._port,
        "executeRead",
        {
          dbName: this.rawDatabase.name,
          store: this.name,
          call: {
            method: "getAllRecords",
            params: { query: newRecord.key, count: 1 }
          }
        }
      ))[0].length;
      recordExists = ct !== 0;
    }
    if (recordExists) {
      if (noOverwrite) {
        throw new ConstraintError();
      }
      this.deleteRecord(newRecord.key, rollbackLog);
    }
    this.records.add(newRecord);
    if (rollbackLog) {
      rollbackLog.push(() => {
        this.deleteRecord(newRecord.key);
      });
    }
    for (const rawIndex of this.rawIndexes.values()) {
      if (rawIndex.initialized) {
        rawIndex.storeRecord(newRecord);
      }
    }
    return newRecord.key;
  }
  // http://www.w3.org/TR/2015/REC-IndexedDB-20150108/#dfn-steps-for-deleting-records-from-an-object-store
  deleteRecord(key, rollbackLog) {
    const deletedRecords = this.records.delete(key);
    if (rollbackLog) {
      for (const record of deletedRecords) {
        rollbackLog.push(() => {
          this.storeRecord(record, true);
        });
      }
    }
    for (const rawIndex of this.rawIndexes.values()) {
      rawIndex.records.deleteByValue(key);
    }
  }
  // http://www.w3.org/TR/2015/REC-IndexedDB-20150108/#dfn-steps-for-clearing-an-object-store
  clear(rollbackLog) {
    const deletedRecords = this.records.clear();
    if (rollbackLog) {
      for (const record of deletedRecords) {
        rollbackLog.push(() => {
          this.storeRecord(record, true);
        });
      }
    }
    for (const rawIndex of this.rawIndexes.values()) {
      rawIndex.records.clear();
    }
  }
  async count(range) {
    return (await this.getAllKeys(range)).length;
  }
}
_oldName = new WeakMap();
class Index {
  constructor(rawObjectStore, name, keyPath, multiEntry, unique) {
    __privateAdd(this, _Index_instances);
    __publicField(this, "deleted", false);
    // Initialized should be used to decide whether to throw an error or abort the versionchange transaction when there is a
    // constraint
    __publicField(this, "initialized", false);
    __publicField(this, "rawObjectStore");
    __publicField(this, "records", new RecordStore());
    __privateAdd(this, _oldName2);
    __publicField(this, "_name");
    __publicField(this, "keyPath");
    __publicField(this, "multiEntry");
    __publicField(this, "unique");
    this.rawObjectStore = rawObjectStore;
    this._name = name;
    this.keyPath = keyPath;
    this.multiEntry = multiEntry;
    this.unique = unique;
  }
  get name() {
    return this._name;
  }
  set name(v) {
    if (__privateGet(this, _oldName2) === void 0) {
      __privateSet(this, _oldName2, this._name);
    }
    this._name = v;
  }
  // http://www.w3.org/TR/2015/REC-IndexedDB-20150108/#dfn-steps-for-retrieving-a-value-from-an-index
  async getKey(key) {
    const out = await this._getAllRecords(
      key instanceof FDBKeyRange ? key : FDBKeyRange.only(key),
      1
    );
    if (out.length === 0) {
      return void 0;
    }
    return out[0].value;
  }
  // http://w3c.github.io/IndexedDB/#retrieve-multiple-referenced-values-from-an-index
  async getAllKeys(range, count) {
    if (count === void 0 || count === 0) {
      count = Infinity;
    }
    const records = await this._getAllRecords(
      range instanceof FDBKeyRange ? range : FDBKeyRange.only(range),
      count
    );
    const out = [];
    for (const record of records) {
      out.push(structuredClone(record.value));
      if (out.length >= count) {
        break;
      }
    }
    return out;
  }
  // http://www.w3.org/TR/2015/REC-IndexedDB-20150108/#index-referenced-value-retrieval-operation
  async getValue(key) {
    const record = (await this._getAllRecords(
      key instanceof FDBKeyRange ? key : FDBKeyRange.only(key),
      1
    ))[0];
    const foundValue = record !== void 0 ? await this.rawObjectStore.getValue(record.value) : void 0;
    return foundValue;
  }
  async _executeReadMethod(method, params) {
    const readCall = { method, params };
    return await call(
      this.rawObjectStore.rawDatabase._port,
      "executeRead",
      {
        params: {
          dbName: this.rawObjectStore.rawDatabase.name,
          store: this.rawObjectStore.committedName,
          call: readCall
        },
        transferableObjects: []
      }
    );
  }
  cleanupAfterCompletedTransaction() {
    __privateSet(this, _oldName2, void 0);
    this.records.cleanupAfterCompletedTransaction();
  }
  async _getAllRecords(range, count) {
    if (count === void 0 || count === 0) {
      count = Infinity;
    }
    const kvPromise = this._executeReadMethod(
      "getAllRecordsFromIndex",
      {
        indexName: __privateGet(this, _Index_instances, committedName_get),
        query: range,
        count: Number.isFinite(count) ? count : void 0
      }
    );
    const cachedRecords = [];
    for (const record of this.records.values(range)) {
      cachedRecords.push(structuredClone(record));
      if (cachedRecords.length >= count) {
        break;
      }
    }
    const [values, keys] = await kvPromise;
    const fetchedRecords = keys.flatMap((k, i2) => {
      const inlineRecord = { key: k, value: values[i2] };
      return this.convertRecordToIndexRecord(inlineRecord, true);
    }).filter((v) => !this.rawObjectStore.records.modified(v.value));
    const out = [];
    let i = 0, j = 0;
    while (fetchedRecords.length > i && cachedRecords.length > j && out.length < count) {
      switch (cmp(fetchedRecords[i].key, cachedRecords[j].key)) {
        case -1: {
          out.push(fetchedRecords[i++]);
          break;
        }
        case 1: {
          out.push(cachedRecords[j++]);
          break;
        }
        case 0: {
          out.push(fetchedRecords[i++]);
          out.push(cachedRecords[j++]);
        }
      }
    }
    if (out.length === count) {
      return out;
    }
    if (fetchedRecords.length > i) {
      out.push(...fetchedRecords.slice(i, i + (count - out.length)));
    }
    if (cachedRecords.length > j) {
      out.push(...cachedRecords.slice(j, j + (count - out.length)));
    }
    return out;
  }
  // http://w3c.github.io/IndexedDB/#retrieve-multiple-referenced-values-from-an-index
  async getAllValues(range, count) {
    if (count === void 0 || count === 0) {
      count = Infinity;
    }
    const records = await this._getAllRecords(
      range instanceof FDBKeyRange ? range : FDBKeyRange.only(range),
      count
    );
    const outPromises = [];
    for (const record of records) {
      outPromises.push(this.rawObjectStore.getValue(record.value));
      if (outPromises.length >= count) {
        break;
      }
    }
    return await Promise.all(outPromises);
  }
  convertRecordToIndexRecord(record, skipUniquenessVerification = false) {
    let indexKey;
    try {
      indexKey = extractKey(this.keyPath, record.value).key;
    } catch (err) {
      const error = err;
      if (error.name === "DataError") {
        return [];
      }
      throw err;
    }
    if (!this.multiEntry || !Array.isArray(indexKey)) {
      try {
        valueToKey(indexKey);
      } catch (e) {
        return [];
      }
    } else {
      const keep = [];
      for (const part of indexKey) {
        if (keep.indexOf(part) < 0) {
          try {
            keep.push(valueToKey(part));
          } catch (_err) {
          }
        }
      }
      indexKey = keep;
    }
    if (!skipUniquenessVerification) {
      if (!this.multiEntry || !Array.isArray(indexKey)) {
        if (this.unique) {
          const existingRecord = this.records.get(indexKey);
          if (existingRecord) {
            throw new ConstraintError();
          }
        }
      } else {
        if (this.unique) {
          for (const individualIndexKey of indexKey) {
            const existingRecord = this.records.get(individualIndexKey);
            if (existingRecord) {
              throw new ConstraintError();
            }
          }
        }
      }
    }
    if (!this.multiEntry || !Array.isArray(indexKey)) {
      return {
        key: indexKey,
        value: record.key
      };
    } else {
      return indexKey.map((v) => {
        return {
          key: v,
          value: record.key
        };
      });
    }
  }
  // http://www.w3.org/TR/2015/REC-IndexedDB-20150108/#dfn-steps-for-storing-a-record-into-an-object-store (step 7)
  storeRecord(newRecord) {
    const idxRecord = this.convertRecordToIndexRecord(newRecord);
    if (Array.isArray(idxRecord)) {
      for (const record of idxRecord) {
        this.records.add(record);
      }
    } else {
      this.records.add(idxRecord);
    }
  }
  initialize(transaction) {
    if (this.initialized) {
      throw new Error("Index already initialized");
    }
    transaction._execRequestAsync({
      operation: () => {
        try {
          for (const record of this.rawObjectStore.records.values()) {
            this.storeRecord(record);
          }
          this.initialized = true;
        } catch (err) {
          transaction._abort(err.name);
        }
      },
      source: null
    });
  }
  count(range) {
    let count = 0;
    for (const _record of this.records.values(range)) {
      count += 1;
    }
    return count;
  }
}
_oldName2 = new WeakMap();
_Index_instances = new WeakSet();
committedName_get = function() {
  return __privateGet(this, _oldName2) ?? this.name;
};
const validateKeyPath = (keyPath, parent) => {
  if (keyPath !== void 0 && keyPath !== null && typeof keyPath !== "string" && keyPath.toString && (parent === "array" || !Array.isArray(keyPath))) {
    keyPath = keyPath.toString();
  }
  if (typeof keyPath === "string") {
    if (keyPath === "" && parent !== "string") {
      return;
    }
    try {
      const validIdentifierRegex = (
        // eslint-disable-next-line no-misleading-character-class
        /^(?:[$A-Z_a-z\xAA\xB5\xBA\xC0-\xD6\xD8-\xF6\xF8-\u02C1\u02C6-\u02D1\u02E0-\u02E4\u02EC\u02EE\u0370-\u0374\u0376\u0377\u037A-\u037D\u037F\u0386\u0388-\u038A\u038C\u038E-\u03A1\u03A3-\u03F5\u03F7-\u0481\u048A-\u052F\u0531-\u0556\u0559\u0561-\u0587\u05D0-\u05EA\u05F0-\u05F2\u0620-\u064A\u066E\u066F\u0671-\u06D3\u06D5\u06E5\u06E6\u06EE\u06EF\u06FA-\u06FC\u06FF\u0710\u0712-\u072F\u074D-\u07A5\u07B1\u07CA-\u07EA\u07F4\u07F5\u07FA\u0800-\u0815\u081A\u0824\u0828\u0840-\u0858\u08A0-\u08B2\u0904-\u0939\u093D\u0950\u0958-\u0961\u0971-\u0980\u0985-\u098C\u098F\u0990\u0993-\u09A8\u09AA-\u09B0\u09B2\u09B6-\u09B9\u09BD\u09CE\u09DC\u09DD\u09DF-\u09E1\u09F0\u09F1\u0A05-\u0A0A\u0A0F\u0A10\u0A13-\u0A28\u0A2A-\u0A30\u0A32\u0A33\u0A35\u0A36\u0A38\u0A39\u0A59-\u0A5C\u0A5E\u0A72-\u0A74\u0A85-\u0A8D\u0A8F-\u0A91\u0A93-\u0AA8\u0AAA-\u0AB0\u0AB2\u0AB3\u0AB5-\u0AB9\u0ABD\u0AD0\u0AE0\u0AE1\u0B05-\u0B0C\u0B0F\u0B10\u0B13-\u0B28\u0B2A-\u0B30\u0B32\u0B33\u0B35-\u0B39\u0B3D\u0B5C\u0B5D\u0B5F-\u0B61\u0B71\u0B83\u0B85-\u0B8A\u0B8E-\u0B90\u0B92-\u0B95\u0B99\u0B9A\u0B9C\u0B9E\u0B9F\u0BA3\u0BA4\u0BA8-\u0BAA\u0BAE-\u0BB9\u0BD0\u0C05-\u0C0C\u0C0E-\u0C10\u0C12-\u0C28\u0C2A-\u0C39\u0C3D\u0C58\u0C59\u0C60\u0C61\u0C85-\u0C8C\u0C8E-\u0C90\u0C92-\u0CA8\u0CAA-\u0CB3\u0CB5-\u0CB9\u0CBD\u0CDE\u0CE0\u0CE1\u0CF1\u0CF2\u0D05-\u0D0C\u0D0E-\u0D10\u0D12-\u0D3A\u0D3D\u0D4E\u0D60\u0D61\u0D7A-\u0D7F\u0D85-\u0D96\u0D9A-\u0DB1\u0DB3-\u0DBB\u0DBD\u0DC0-\u0DC6\u0E01-\u0E30\u0E32\u0E33\u0E40-\u0E46\u0E81\u0E82\u0E84\u0E87\u0E88\u0E8A\u0E8D\u0E94-\u0E97\u0E99-\u0E9F\u0EA1-\u0EA3\u0EA5\u0EA7\u0EAA\u0EAB\u0EAD-\u0EB0\u0EB2\u0EB3\u0EBD\u0EC0-\u0EC4\u0EC6\u0EDC-\u0EDF\u0F00\u0F40-\u0F47\u0F49-\u0F6C\u0F88-\u0F8C\u1000-\u102A\u103F\u1050-\u1055\u105A-\u105D\u1061\u1065\u1066\u106E-\u1070\u1075-\u1081\u108E\u10A0-\u10C5\u10C7\u10CD\u10D0-\u10FA\u10FC-\u1248\u124A-\u124D\u1250-\u1256\u1258\u125A-\u125D\u1260-\u1288\u128A-\u128D\u1290-\u12B0\u12B2-\u12B5\u12B8-\u12BE\u12C0\u12C2-\u12C5\u12C8-\u12D6\u12D8-\u1310\u1312-\u1315\u1318-\u135A\u1380-\u138F\u13A0-\u13F4\u1401-\u166C\u166F-\u167F\u1681-\u169A\u16A0-\u16EA\u16EE-\u16F8\u1700-\u170C\u170E-\u1711\u1720-\u1731\u1740-\u1751\u1760-\u176C\u176E-\u1770\u1780-\u17B3\u17D7\u17DC\u1820-\u1877\u1880-\u18A8\u18AA\u18B0-\u18F5\u1900-\u191E\u1950-\u196D\u1970-\u1974\u1980-\u19AB\u19C1-\u19C7\u1A00-\u1A16\u1A20-\u1A54\u1AA7\u1B05-\u1B33\u1B45-\u1B4B\u1B83-\u1BA0\u1BAE\u1BAF\u1BBA-\u1BE5\u1C00-\u1C23\u1C4D-\u1C4F\u1C5A-\u1C7D\u1CE9-\u1CEC\u1CEE-\u1CF1\u1CF5\u1CF6\u1D00-\u1DBF\u1E00-\u1F15\u1F18-\u1F1D\u1F20-\u1F45\u1F48-\u1F4D\u1F50-\u1F57\u1F59\u1F5B\u1F5D\u1F5F-\u1F7D\u1F80-\u1FB4\u1FB6-\u1FBC\u1FBE\u1FC2-\u1FC4\u1FC6-\u1FCC\u1FD0-\u1FD3\u1FD6-\u1FDB\u1FE0-\u1FEC\u1FF2-\u1FF4\u1FF6-\u1FFC\u2071\u207F\u2090-\u209C\u2102\u2107\u210A-\u2113\u2115\u2119-\u211D\u2124\u2126\u2128\u212A-\u212D\u212F-\u2139\u213C-\u213F\u2145-\u2149\u214E\u2160-\u2188\u2C00-\u2C2E\u2C30-\u2C5E\u2C60-\u2CE4\u2CEB-\u2CEE\u2CF2\u2CF3\u2D00-\u2D25\u2D27\u2D2D\u2D30-\u2D67\u2D6F\u2D80-\u2D96\u2DA0-\u2DA6\u2DA8-\u2DAE\u2DB0-\u2DB6\u2DB8-\u2DBE\u2DC0-\u2DC6\u2DC8-\u2DCE\u2DD0-\u2DD6\u2DD8-\u2DDE\u2E2F\u3005-\u3007\u3021-\u3029\u3031-\u3035\u3038-\u303C\u3041-\u3096\u309D-\u309F\u30A1-\u30FA\u30FC-\u30FF\u3105-\u312D\u3131-\u318E\u31A0-\u31BA\u31F0-\u31FF\u3400-\u4DB5\u4E00-\u9FCC\uA000-\uA48C\uA4D0-\uA4FD\uA500-\uA60C\uA610-\uA61F\uA62A\uA62B\uA640-\uA66E\uA67F-\uA69D\uA6A0-\uA6EF\uA717-\uA71F\uA722-\uA788\uA78B-\uA78E\uA790-\uA7AD\uA7B0\uA7B1\uA7F7-\uA801\uA803-\uA805\uA807-\uA80A\uA80C-\uA822\uA840-\uA873\uA882-\uA8B3\uA8F2-\uA8F7\uA8FB\uA90A-\uA925\uA930-\uA946\uA960-\uA97C\uA984-\uA9B2\uA9CF\uA9E0-\uA9E4\uA9E6-\uA9EF\uA9FA-\uA9FE\uAA00-\uAA28\uAA40-\uAA42\uAA44-\uAA4B\uAA60-\uAA76\uAA7A\uAA7E-\uAAAF\uAAB1\uAAB5\uAAB6\uAAB9-\uAABD\uAAC0\uAAC2\uAADB-\uAADD\uAAE0-\uAAEA\uAAF2-\uAAF4\uAB01-\uAB06\uAB09-\uAB0E\uAB11-\uAB16\uAB20-\uAB26\uAB28-\uAB2E\uAB30-\uAB5A\uAB5C-\uAB5F\uAB64\uAB65\uABC0-\uABE2\uAC00-\uD7A3\uD7B0-\uD7C6\uD7CB-\uD7FB\uF900-\uFA6D\uFA70-\uFAD9\uFB00-\uFB06\uFB13-\uFB17\uFB1D\uFB1F-\uFB28\uFB2A-\uFB36\uFB38-\uFB3C\uFB3E\uFB40\uFB41\uFB43\uFB44\uFB46-\uFBB1\uFBD3-\uFD3D\uFD50-\uFD8F\uFD92-\uFDC7\uFDF0-\uFDFB\uFE70-\uFE74\uFE76-\uFEFC\uFF21-\uFF3A\uFF41-\uFF5A\uFF66-\uFFBE\uFFC2-\uFFC7\uFFCA-\uFFCF\uFFD2-\uFFD7\uFFDA-\uFFDC])(?:[$0-9A-Z_a-z\xAA\xB5\xBA\xC0-\xD6\xD8-\xF6\xF8-\u02C1\u02C6-\u02D1\u02E0-\u02E4\u02EC\u02EE\u0300-\u0374\u0376\u0377\u037A-\u037D\u037F\u0386\u0388-\u038A\u038C\u038E-\u03A1\u03A3-\u03F5\u03F7-\u0481\u0483-\u0487\u048A-\u052F\u0531-\u0556\u0559\u0561-\u0587\u0591-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7\u05D0-\u05EA\u05F0-\u05F2\u0610-\u061A\u0620-\u0669\u066E-\u06D3\u06D5-\u06DC\u06DF-\u06E8\u06EA-\u06FC\u06FF\u0710-\u074A\u074D-\u07B1\u07C0-\u07F5\u07FA\u0800-\u082D\u0840-\u085B\u08A0-\u08B2\u08E4-\u0963\u0966-\u096F\u0971-\u0983\u0985-\u098C\u098F\u0990\u0993-\u09A8\u09AA-\u09B0\u09B2\u09B6-\u09B9\u09BC-\u09C4\u09C7\u09C8\u09CB-\u09CE\u09D7\u09DC\u09DD\u09DF-\u09E3\u09E6-\u09F1\u0A01-\u0A03\u0A05-\u0A0A\u0A0F\u0A10\u0A13-\u0A28\u0A2A-\u0A30\u0A32\u0A33\u0A35\u0A36\u0A38\u0A39\u0A3C\u0A3E-\u0A42\u0A47\u0A48\u0A4B-\u0A4D\u0A51\u0A59-\u0A5C\u0A5E\u0A66-\u0A75\u0A81-\u0A83\u0A85-\u0A8D\u0A8F-\u0A91\u0A93-\u0AA8\u0AAA-\u0AB0\u0AB2\u0AB3\u0AB5-\u0AB9\u0ABC-\u0AC5\u0AC7-\u0AC9\u0ACB-\u0ACD\u0AD0\u0AE0-\u0AE3\u0AE6-\u0AEF\u0B01-\u0B03\u0B05-\u0B0C\u0B0F\u0B10\u0B13-\u0B28\u0B2A-\u0B30\u0B32\u0B33\u0B35-\u0B39\u0B3C-\u0B44\u0B47\u0B48\u0B4B-\u0B4D\u0B56\u0B57\u0B5C\u0B5D\u0B5F-\u0B63\u0B66-\u0B6F\u0B71\u0B82\u0B83\u0B85-\u0B8A\u0B8E-\u0B90\u0B92-\u0B95\u0B99\u0B9A\u0B9C\u0B9E\u0B9F\u0BA3\u0BA4\u0BA8-\u0BAA\u0BAE-\u0BB9\u0BBE-\u0BC2\u0BC6-\u0BC8\u0BCA-\u0BCD\u0BD0\u0BD7\u0BE6-\u0BEF\u0C00-\u0C03\u0C05-\u0C0C\u0C0E-\u0C10\u0C12-\u0C28\u0C2A-\u0C39\u0C3D-\u0C44\u0C46-\u0C48\u0C4A-\u0C4D\u0C55\u0C56\u0C58\u0C59\u0C60-\u0C63\u0C66-\u0C6F\u0C81-\u0C83\u0C85-\u0C8C\u0C8E-\u0C90\u0C92-\u0CA8\u0CAA-\u0CB3\u0CB5-\u0CB9\u0CBC-\u0CC4\u0CC6-\u0CC8\u0CCA-\u0CCD\u0CD5\u0CD6\u0CDE\u0CE0-\u0CE3\u0CE6-\u0CEF\u0CF1\u0CF2\u0D01-\u0D03\u0D05-\u0D0C\u0D0E-\u0D10\u0D12-\u0D3A\u0D3D-\u0D44\u0D46-\u0D48\u0D4A-\u0D4E\u0D57\u0D60-\u0D63\u0D66-\u0D6F\u0D7A-\u0D7F\u0D82\u0D83\u0D85-\u0D96\u0D9A-\u0DB1\u0DB3-\u0DBB\u0DBD\u0DC0-\u0DC6\u0DCA\u0DCF-\u0DD4\u0DD6\u0DD8-\u0DDF\u0DE6-\u0DEF\u0DF2\u0DF3\u0E01-\u0E3A\u0E40-\u0E4E\u0E50-\u0E59\u0E81\u0E82\u0E84\u0E87\u0E88\u0E8A\u0E8D\u0E94-\u0E97\u0E99-\u0E9F\u0EA1-\u0EA3\u0EA5\u0EA7\u0EAA\u0EAB\u0EAD-\u0EB9\u0EBB-\u0EBD\u0EC0-\u0EC4\u0EC6\u0EC8-\u0ECD\u0ED0-\u0ED9\u0EDC-\u0EDF\u0F00\u0F18\u0F19\u0F20-\u0F29\u0F35\u0F37\u0F39\u0F3E-\u0F47\u0F49-\u0F6C\u0F71-\u0F84\u0F86-\u0F97\u0F99-\u0FBC\u0FC6\u1000-\u1049\u1050-\u109D\u10A0-\u10C5\u10C7\u10CD\u10D0-\u10FA\u10FC-\u1248\u124A-\u124D\u1250-\u1256\u1258\u125A-\u125D\u1260-\u1288\u128A-\u128D\u1290-\u12B0\u12B2-\u12B5\u12B8-\u12BE\u12C0\u12C2-\u12C5\u12C8-\u12D6\u12D8-\u1310\u1312-\u1315\u1318-\u135A\u135D-\u135F\u1380-\u138F\u13A0-\u13F4\u1401-\u166C\u166F-\u167F\u1681-\u169A\u16A0-\u16EA\u16EE-\u16F8\u1700-\u170C\u170E-\u1714\u1720-\u1734\u1740-\u1753\u1760-\u176C\u176E-\u1770\u1772\u1773\u1780-\u17D3\u17D7\u17DC\u17DD\u17E0-\u17E9\u180B-\u180D\u1810-\u1819\u1820-\u1877\u1880-\u18AA\u18B0-\u18F5\u1900-\u191E\u1920-\u192B\u1930-\u193B\u1946-\u196D\u1970-\u1974\u1980-\u19AB\u19B0-\u19C9\u19D0-\u19D9\u1A00-\u1A1B\u1A20-\u1A5E\u1A60-\u1A7C\u1A7F-\u1A89\u1A90-\u1A99\u1AA7\u1AB0-\u1ABD\u1B00-\u1B4B\u1B50-\u1B59\u1B6B-\u1B73\u1B80-\u1BF3\u1C00-\u1C37\u1C40-\u1C49\u1C4D-\u1C7D\u1CD0-\u1CD2\u1CD4-\u1CF6\u1CF8\u1CF9\u1D00-\u1DF5\u1DFC-\u1F15\u1F18-\u1F1D\u1F20-\u1F45\u1F48-\u1F4D\u1F50-\u1F57\u1F59\u1F5B\u1F5D\u1F5F-\u1F7D\u1F80-\u1FB4\u1FB6-\u1FBC\u1FBE\u1FC2-\u1FC4\u1FC6-\u1FCC\u1FD0-\u1FD3\u1FD6-\u1FDB\u1FE0-\u1FEC\u1FF2-\u1FF4\u1FF6-\u1FFC\u200C\u200D\u203F\u2040\u2054\u2071\u207F\u2090-\u209C\u20D0-\u20DC\u20E1\u20E5-\u20F0\u2102\u2107\u210A-\u2113\u2115\u2119-\u211D\u2124\u2126\u2128\u212A-\u212D\u212F-\u2139\u213C-\u213F\u2145-\u2149\u214E\u2160-\u2188\u2C00-\u2C2E\u2C30-\u2C5E\u2C60-\u2CE4\u2CEB-\u2CF3\u2D00-\u2D25\u2D27\u2D2D\u2D30-\u2D67\u2D6F\u2D7F-\u2D96\u2DA0-\u2DA6\u2DA8-\u2DAE\u2DB0-\u2DB6\u2DB8-\u2DBE\u2DC0-\u2DC6\u2DC8-\u2DCE\u2DD0-\u2DD6\u2DD8-\u2DDE\u2DE0-\u2DFF\u2E2F\u3005-\u3007\u3021-\u302F\u3031-\u3035\u3038-\u303C\u3041-\u3096\u3099\u309A\u309D-\u309F\u30A1-\u30FA\u30FC-\u30FF\u3105-\u312D\u3131-\u318E\u31A0-\u31BA\u31F0-\u31FF\u3400-\u4DB5\u4E00-\u9FCC\uA000-\uA48C\uA4D0-\uA4FD\uA500-\uA60C\uA610-\uA62B\uA640-\uA66F\uA674-\uA67D\uA67F-\uA69D\uA69F-\uA6F1\uA717-\uA71F\uA722-\uA788\uA78B-\uA78E\uA790-\uA7AD\uA7B0\uA7B1\uA7F7-\uA827\uA840-\uA873\uA880-\uA8C4\uA8D0-\uA8D9\uA8E0-\uA8F7\uA8FB\uA900-\uA92D\uA930-\uA953\uA960-\uA97C\uA980-\uA9C0\uA9CF-\uA9D9\uA9E0-\uA9FE\uAA00-\uAA36\uAA40-\uAA4D\uAA50-\uAA59\uAA60-\uAA76\uAA7A-\uAAC2\uAADB-\uAADD\uAAE0-\uAAEF\uAAF2-\uAAF6\uAB01-\uAB06\uAB09-\uAB0E\uAB11-\uAB16\uAB20-\uAB26\uAB28-\uAB2E\uAB30-\uAB5A\uAB5C-\uAB5F\uAB64\uAB65\uABC0-\uABEA\uABEC\uABED\uABF0-\uABF9\uAC00-\uD7A3\uD7B0-\uD7C6\uD7CB-\uD7FB\uF900-\uFA6D\uFA70-\uFAD9\uFB00-\uFB06\uFB13-\uFB17\uFB1D-\uFB28\uFB2A-\uFB36\uFB38-\uFB3C\uFB3E\uFB40\uFB41\uFB43\uFB44\uFB46-\uFBB1\uFBD3-\uFD3D\uFD50-\uFD8F\uFD92-\uFDC7\uFDF0-\uFDFB\uFE00-\uFE0F\uFE20-\uFE2D\uFE33\uFE34\uFE4D-\uFE4F\uFE70-\uFE74\uFE76-\uFEFC\uFF10-\uFF19\uFF21-\uFF3A\uFF3F\uFF41-\uFF5A\uFF66-\uFFBE\uFFC2-\uFFC7\uFFCA-\uFFCF\uFFD2-\uFFD7\uFFDA-\uFFDC])*$/
      );
      if (keyPath.length >= 1 && validIdentifierRegex.test(keyPath)) {
        return;
      }
    } catch (err) {
      throw new SyntaxError(err.message);
    }
    if (keyPath.indexOf(" ") >= 0) {
      throw new SyntaxError(
        "The keypath argument contains an invalid key path (no spaces allowed)."
      );
    }
  }
  if (Array.isArray(keyPath) && keyPath.length > 0) {
    if (parent) {
      throw new SyntaxError(
        "The keypath argument contains an invalid key path (nested arrays)."
      );
    }
    for (const part of keyPath) {
      validateKeyPath(part, "array");
    }
    return;
  } else if (typeof keyPath === "string" && keyPath.indexOf(".") >= 0) {
    keyPath = keyPath.split(".");
    for (const part of keyPath) {
      validateKeyPath(part, "string");
    }
    return;
  }
  throw new SyntaxError();
};
const valueToKeyRange = (value, nullDisallowedFlag = false) => {
  if (value instanceof FDBKeyRange) {
    return value;
  }
  if (value === null || value === void 0) {
    if (nullDisallowedFlag) {
      throw new DataError();
    }
    return new FDBKeyRange(void 0, void 0, false, false);
  }
  const key = valueToKey(value);
  return FDBKeyRange.only(key);
};
const confirmActiveTransaction$1 = (objectStore) => {
  if (objectStore._rawObjectStore.deleted) {
    throw new InvalidStateError();
  }
  if (objectStore.transaction._state !== "active") {
    throw new TransactionInactiveError();
  }
};
const buildRecordAddPut = (objectStore, value, key) => {
  confirmActiveTransaction$1(objectStore);
  if (objectStore.transaction.mode === "readonly") {
    throw new ReadOnlyError();
  }
  if (objectStore.keyPath !== null) {
    if (key !== void 0) {
      throw new DataError();
    }
  }
  const clone = structuredClone(value);
  if (objectStore.keyPath !== null) {
    const tempKey = extractKey(objectStore.keyPath, clone);
    if (tempKey.type === "found") {
      valueToKey(tempKey.key);
    } else {
      if (!objectStore._rawObjectStore.keyGenerator) {
        throw new DataError();
      } else if (!canInjectKey(objectStore.keyPath, clone)) {
        throw new DataError();
      }
    }
  }
  if (objectStore.keyPath === null && objectStore._rawObjectStore.keyGenerator === null && key === void 0) {
    throw new DataError();
  }
  if (key !== void 0) {
    key = valueToKey(key);
  }
  return {
    key,
    value: clone
  };
};
class FDBObjectStore {
  constructor(transaction, rawObjectStore, updateWriteLog, justCreated) {
    __publicField(this, "_rawObjectStore");
    __publicField(this, "_indexesCache", /* @__PURE__ */ new Map());
    __publicField(this, "_updateWriteLog");
    __publicField(this, "keyPath");
    __publicField(this, "autoIncrement");
    __publicField(this, "transaction");
    __publicField(this, "indexNames");
    __publicField(this, "_name");
    // necessary for test "IndexedDB object store creation and rename in an aborted transaction"
    __publicField(this, "_nameBeforeTxStart");
    this._rawObjectStore = rawObjectStore;
    this._updateWriteLog = updateWriteLog;
    this._name = rawObjectStore.name;
    if (!justCreated) {
      this._nameBeforeTxStart = this._name;
    }
    this.keyPath = Array.isArray(rawObjectStore.keyPath) ? structuredClone(rawObjectStore.keyPath) : rawObjectStore.keyPath;
    this.autoIncrement = rawObjectStore.autoIncrement;
    this.transaction = transaction;
    this.indexNames = new FakeDOMStringList(
      ...Array.from(rawObjectStore.rawIndexes.keys()).sort()
    );
  }
  get name() {
    return this._name;
  }
  // http://w3c.github.io/IndexedDB/#dom-idbobjectstore-name
  set name(name) {
    const transaction = this.transaction;
    if (transaction.mode !== "versionchange") {
      throw new InvalidStateError();
    }
    confirmActiveTransaction$1(this);
    name = String(name);
    if (name === this._name) {
      return;
    }
    if (this._rawObjectStore.rawDatabase.rawObjectStores.has(name)) {
      throw new ConstraintError();
    }
    const oldName = this._name;
    const oldObjectStoreNames = [...transaction.db.objectStoreNames];
    this._name = name;
    this._rawObjectStore.name = name;
    this.transaction._objectStoresCache.delete(oldName);
    this.transaction._objectStoresCache.set(name, this);
    this._rawObjectStore.rawDatabase.rawObjectStores.delete(oldName);
    this._rawObjectStore.rawDatabase.rawObjectStores.set(
      name,
      this._rawObjectStore
    );
    transaction.db.objectStoreNames = new FakeDOMStringList(
      ...Array.from(
        this._rawObjectStore.rawDatabase.rawObjectStores.keys()
      ).filter((objectStoreName) => {
        const objectStore = this._rawObjectStore.rawDatabase.rawObjectStores.get(
          objectStoreName
        );
        return objectStore && !objectStore.deleted;
      }).sort()
    );
    const oldScope = new Set(transaction._scope);
    const oldTransactionObjectStoreNames = [...transaction.objectStoreNames];
    this.transaction._scope.delete(oldName);
    transaction._scope.add(name);
    transaction.objectStoreNames = new FakeDOMStringList(
      ...Array.from(transaction._scope).sort()
    );
    transaction._rollbackLog.push(() => {
      if (this._nameBeforeTxStart !== void 0)
        this._name = this._nameBeforeTxStart;
      this._rawObjectStore.name = oldName;
      this.transaction._objectStoresCache.delete(name);
      this.transaction._objectStoresCache.set(oldName, this);
      this._rawObjectStore.rawDatabase.rawObjectStores.delete(name);
      this._rawObjectStore.rawDatabase.rawObjectStores.set(
        oldName,
        this._rawObjectStore
      );
      transaction.db.objectStoreNames = new FakeDOMStringList(
        ...oldObjectStoreNames
      );
      transaction._scope = oldScope;
      transaction.objectStoreNames = new FakeDOMStringList(
        ...oldTransactionObjectStoreNames
      );
    });
    this._updateWriteLog.push({
      method: "renameObjectStore",
      params: { newName: name }
    });
  }
  put(value, key) {
    if (arguments.length === 0) {
      throw new TypeError();
    }
    const record = buildRecordAddPut(this, value, key);
    this._updateWriteLog.push({
      method: "put",
      params: {
        value,
        key
      }
    });
    return this.transaction._execRequestAsync({
      operation: this._rawObjectStore.storeRecord.bind(
        this._rawObjectStore,
        record,
        false,
        this.transaction._rollbackLog
      ),
      source: this
    });
  }
  add(value, key) {
    if (arguments.length === 0) {
      throw new TypeError();
    }
    const record = buildRecordAddPut(this, value, key);
    this._updateWriteLog.push({
      method: "add",
      params: {
        value,
        key
      }
    });
    return this.transaction._execRequestAsync({
      operation: this._rawObjectStore.storeRecord.bind(
        this._rawObjectStore,
        record,
        true,
        this.transaction._rollbackLog
      ),
      source: this
    });
  }
  delete(key) {
    if (arguments.length === 0) {
      throw new TypeError();
    }
    confirmActiveTransaction$1(this);
    if (this.transaction.mode === "readonly") {
      throw new ReadOnlyError();
    }
    if (!(key instanceof FDBKeyRange)) {
      key = valueToKey(key);
    }
    this._updateWriteLog.push({
      method: "delete",
      params: {
        query: key
      }
    });
    return this.transaction._execRequestAsync({
      operation: this._rawObjectStore.deleteRecord.bind(
        this._rawObjectStore,
        key,
        this.transaction._rollbackLog
      ),
      source: this
    });
  }
  get(key) {
    if (arguments.length === 0) {
      throw new TypeError();
    }
    confirmActiveTransaction$1(this);
    if (!(key instanceof FDBKeyRange)) {
      key = valueToKey(key);
    }
    return this.transaction._execRequestAsync({
      operation: this._rawObjectStore.getValue.bind(
        this._rawObjectStore,
        key
      ),
      source: this
    });
  }
  // http://w3c.github.io/IndexedDB/#dom-idbobjectstore-getall
  getAll(query, count) {
    if (arguments.length > 1 && count !== void 0) {
      count = enforceRange(count, "unsigned long");
    }
    confirmActiveTransaction$1(this);
    const range = valueToKeyRange(query);
    return this.transaction._execRequestAsync({
      operation: this._rawObjectStore.getAllValues.bind(
        this._rawObjectStore,
        range,
        count
      ),
      source: this
    });
  }
  // http://w3c.github.io/IndexedDB/#dom-idbobjectstore-getkey
  getKey(key) {
    if (arguments.length === 0) {
      throw new TypeError();
    }
    confirmActiveTransaction$1(this);
    if (!(key instanceof FDBKeyRange)) {
      key = valueToKey(key);
    }
    return this.transaction._execRequestAsync({
      operation: this._rawObjectStore.getKey.bind(
        this._rawObjectStore,
        key
      ),
      source: this
    });
  }
  // http://w3c.github.io/IndexedDB/#dom-idbobjectstore-getallkeys
  getAllKeys(query, count) {
    if (arguments.length > 1 && count !== void 0) {
      count = enforceRange(count, "unsigned long");
    }
    confirmActiveTransaction$1(this);
    const range = valueToKeyRange(query);
    return this.transaction._execRequestAsync({
      operation: this._rawObjectStore.getAllKeys.bind(
        this._rawObjectStore,
        range,
        count
      ),
      source: this
    });
  }
  clear() {
    confirmActiveTransaction$1(this);
    if (this.transaction.mode === "readonly") {
      throw new ReadOnlyError();
    }
    this._updateWriteLog.push({
      method: "clear",
      params: void 0
    });
    return this.transaction._execRequestAsync({
      operation: this._rawObjectStore.clear.bind(
        this._rawObjectStore,
        this.transaction._rollbackLog
      ),
      source: this
    });
  }
  openCursor(range, direction) {
    confirmActiveTransaction$1(this);
    if (range === null) {
      range = void 0;
    }
    if (range !== void 0 && !(range instanceof FDBKeyRange)) {
      range = FDBKeyRange.only(valueToKey(range));
    }
    const request = new FDBRequest();
    request.source = this;
    request.transaction = this.transaction;
    const cursor = new FDBCursorWithValue(this, range, direction, request);
    return this.transaction._execRequestAsync({
      operation: cursor._iterate.bind(cursor),
      request,
      source: this
    });
  }
  openKeyCursor(range, direction) {
    confirmActiveTransaction$1(this);
    if (range === null) {
      range = void 0;
    }
    if (range !== void 0 && !(range instanceof FDBKeyRange)) {
      range = FDBKeyRange.only(valueToKey(range));
    }
    const request = new FDBRequest();
    request.source = this;
    request.transaction = this.transaction;
    const cursor = new FDBCursor(this, range, direction, request);
    return this.transaction._execRequestAsync({
      operation: cursor._iterate.bind(cursor),
      request,
      source: this
    });
  }
  // tslint:-next-line max-line-length
  // http://www.w3.org/TR/2015/REC-IndexedDB-20150108/#widl-IDBObjectStore-createIndex-IDBIndex-DOMString-name-DOMString-sequence-DOMString--keyPath-IDBIndexParameters-optionalParameters
  createIndex(name, keyPath, optionalParameters = {}) {
    if (arguments.length < 2) {
      throw new TypeError();
    }
    const multiEntry = optionalParameters.multiEntry !== void 0 ? optionalParameters.multiEntry : false;
    const unique = optionalParameters.unique !== void 0 ? optionalParameters.unique : false;
    confirmActiveTransaction$1(this);
    if (this.transaction.mode !== "versionchange") {
      throw new InvalidStateError();
    }
    if (this.indexNames.contains(name)) {
      throw new ConstraintError();
    }
    validateKeyPath(keyPath);
    if (Array.isArray(keyPath) && multiEntry) {
      throw new InvalidAccessError();
    }
    const indexNames = [...this.indexNames];
    this.transaction._rollbackLog.push(() => {
      const index2 = this._rawObjectStore.rawIndexes.get(name);
      if (index2) {
        index2.deleted = true;
      }
      this._rawObjectStore.rawIndexes.delete(name);
      this.indexNames = new FakeDOMStringList(...indexNames);
    });
    const index = new Index(
      this._rawObjectStore,
      name,
      keyPath,
      multiEntry,
      unique
    );
    this.indexNames._push(name);
    this.indexNames._sort();
    this._rawObjectStore.rawIndexes.set(name, index);
    index.initialize(this.transaction);
    this._updateWriteLog.push({
      method: "createIndex",
      params: { name, keyPath, options: { multiEntry, unique } }
    });
    return new FDBIndex(this, index);
  }
  // https://w3c.github.io/IndexedDB/#dom-idbobjectstore-index
  index(name) {
    if (arguments.length === 0) {
      throw new TypeError();
    }
    if (this._rawObjectStore.deleted || this.transaction._state === "finished") {
      throw new InvalidStateError();
    }
    const index = this._indexesCache.get(name);
    if (index !== void 0) {
      return index;
    }
    const rawIndex = this._rawObjectStore.rawIndexes.get(name);
    if (!this.indexNames.contains(name) || rawIndex === void 0) {
      throw new NotFoundError();
    }
    const index2 = new FDBIndex(this, rawIndex);
    this._indexesCache.set(name, index2);
    return index2;
  }
  deleteIndex(name) {
    if (arguments.length === 0) {
      throw new TypeError();
    }
    if (this.transaction.mode !== "versionchange") {
      throw new InvalidStateError();
    }
    confirmActiveTransaction$1(this);
    const rawIndex = this._rawObjectStore.rawIndexes.get(name);
    if (rawIndex === void 0 || !this.indexNames.contains(name)) {
      throw new NotFoundError();
    }
    this.transaction._rollbackLog.push(() => {
      rawIndex.deleted = false;
      this._rawObjectStore.rawIndexes.set(name, rawIndex);
      this.indexNames._push(name);
      this.indexNames._sort();
    });
    this.indexNames = new FakeDOMStringList(
      ...Array.from(this.indexNames).filter((indexName) => {
        return indexName !== name;
      })
    );
    rawIndex.deleted = true;
    this.transaction._execRequestAsync({
      operation: () => {
        const rawIndex2 = this._rawObjectStore.rawIndexes.get(name);
        if (rawIndex === rawIndex2) {
          this._rawObjectStore.rawIndexes.delete(name);
        }
      },
      source: this
    });
    this._updateWriteLog.push({
      method: "deleteIndex",
      params: { name }
    });
  }
  // http://www.w3.org/TR/2015/REC-IndexedDB-20150108/#widl-IDBObjectStore-count-IDBRequest-any-key
  count(key) {
    confirmActiveTransaction$1(this);
    if (key === null) {
      key = void 0;
    }
    if (key !== void 0 && !(key instanceof FDBKeyRange)) {
      key = FDBKeyRange.only(valueToKey(key));
    }
    return this.transaction._execRequestAsync({
      operation: async () => {
        return await this._rawObjectStore.count(key);
      },
      source: this
    });
  }
  toString() {
    return "[object IDBObjectStore]";
  }
}
const confirmActiveTransaction = (index) => {
  if (index._rawIndex.deleted || index.objectStore._rawObjectStore.deleted) {
    throw new InvalidStateError();
  }
  if (index.objectStore.transaction._state !== "active") {
    throw new TransactionInactiveError();
  }
};
class FDBIndex {
  constructor(objectStore, rawIndex) {
    __publicField(this, "_rawIndex");
    __publicField(this, "objectStore");
    __publicField(this, "keyPath");
    __publicField(this, "multiEntry");
    __publicField(this, "unique");
    __publicField(this, "_name");
    this._rawIndex = rawIndex;
    this._name = rawIndex.name;
    this.objectStore = objectStore;
    this.keyPath = structuredClone(rawIndex.keyPath);
    this.multiEntry = rawIndex.multiEntry;
    this.unique = rawIndex.unique;
  }
  get name() {
    return this._name;
  }
  // https://w3c.github.io/IndexedDB/#dom-idbindex-name
  set name(name) {
    const transaction = this.objectStore.transaction;
    if (!transaction.db._runningVersionchangeTransaction) {
      throw new InvalidStateError();
    }
    if (transaction._state !== "active") {
      throw new TransactionInactiveError();
    }
    if (this._rawIndex.deleted || this.objectStore._rawObjectStore.deleted) {
      throw new InvalidStateError();
    }
    name = String(name);
    if (name === this._name) {
      return;
    }
    if (this.objectStore.indexNames.contains(name)) {
      throw new ConstraintError();
    }
    const oldName = this._name;
    const oldIndexNames = [...this.objectStore.indexNames];
    this._name = name;
    this._rawIndex.name = name;
    this.objectStore._indexesCache.delete(oldName);
    this.objectStore._indexesCache.set(name, this);
    this.objectStore._rawObjectStore.rawIndexes.delete(oldName);
    this.objectStore._rawObjectStore.rawIndexes.set(name, this._rawIndex);
    this.objectStore.indexNames = new FakeDOMStringList(
      ...Array.from(this.objectStore._rawObjectStore.rawIndexes.keys()).filter((indexName) => {
        const index = this.objectStore._rawObjectStore.rawIndexes.get(
          indexName
        );
        return index && !index.deleted;
      }).sort()
    );
    transaction._rollbackLog.push(() => {
      this._name = oldName;
      this._rawIndex.name = oldName;
      this.objectStore._indexesCache.delete(name);
      this.objectStore._indexesCache.set(oldName, this);
      this.objectStore._rawObjectStore.rawIndexes.delete(name);
      this.objectStore._rawObjectStore.rawIndexes.set(
        oldName,
        this._rawIndex
      );
      this.objectStore.indexNames = new FakeDOMStringList(
        ...oldIndexNames
      );
    });
    this.objectStore._updateWriteLog.push({
      method: "modifyIndex",
      params: {
        name: oldName,
        newName: name
      }
    });
  }
  // http://www.w3.org/TR/2015/REC-IndexedDB-20150108/#widl-IDBIndex-openCursor-IDBRequest-any-range-IDBCursorDirection-direction
  openCursor(range, direction) {
    confirmActiveTransaction(this);
    if (range === null) {
      range = void 0;
    }
    if (range !== void 0 && !(range instanceof FDBKeyRange)) {
      range = FDBKeyRange.only(valueToKey(range));
    }
    const request = new FDBRequest();
    request.source = this;
    request.transaction = this.objectStore.transaction;
    const cursor = new FDBCursorWithValue(this, range, direction, request);
    return this.objectStore.transaction._execRequestAsync({
      operation: cursor._iterate.bind(cursor),
      request,
      source: this
    });
  }
  // http://www.w3.org/TR/2015/REC-IndexedDB-20150108/#widl-IDBIndex-openKeyCursor-IDBRequest-any-range-IDBCursorDirection-direction
  openKeyCursor(range, direction) {
    confirmActiveTransaction(this);
    if (range === null) {
      range = void 0;
    }
    if (range !== void 0 && !(range instanceof FDBKeyRange)) {
      range = FDBKeyRange.only(valueToKey(range));
    }
    const request = new FDBRequest();
    request.source = this;
    request.transaction = this.objectStore.transaction;
    const cursor = new FDBCursor(this, range, direction, request);
    return this.objectStore.transaction._execRequestAsync({
      operation: cursor._iterate.bind(cursor),
      request,
      source: this
    });
  }
  get(key) {
    confirmActiveTransaction(this);
    if (!(key instanceof FDBKeyRange)) {
      key = valueToKey(key);
    }
    return this.objectStore.transaction._execRequestAsync({
      operation: this._rawIndex.getValue.bind(this._rawIndex, key),
      source: this
    });
  }
  // http://w3c.github.io/IndexedDB/#dom-idbindex-getall
  getAll(query, count) {
    if (arguments.length > 1 && count !== void 0) {
      count = enforceRange(count, "unsigned long");
    }
    confirmActiveTransaction(this);
    const range = valueToKeyRange(query);
    return this.objectStore.transaction._execRequestAsync({
      operation: this._rawIndex.getAllValues.bind(
        this._rawIndex,
        range,
        count
      ),
      source: this
    });
  }
  // http://www.w3.org/TR/2015/REC-IndexedDB-20150108/#widl-IDBIndex-getKey-IDBRequest-any-key
  getKey(key) {
    confirmActiveTransaction(this);
    if (!(key instanceof FDBKeyRange)) {
      key = valueToKey(key);
    }
    return this.objectStore.transaction._execRequestAsync({
      operation: this._rawIndex.getKey.bind(this._rawIndex, key),
      source: this
    });
  }
  // http://w3c.github.io/IndexedDB/#dom-idbindex-getallkeys
  getAllKeys(query, count) {
    if (arguments.length > 1 && count !== void 0) {
      count = enforceRange(count, "unsigned long");
    }
    confirmActiveTransaction(this);
    const range = valueToKeyRange(query);
    return this.objectStore.transaction._execRequestAsync({
      operation: this._rawIndex.getAllKeys.bind(
        this._rawIndex,
        range,
        count
      ),
      source: this
    });
  }
  // http://www.w3.org/TR/2015/REC-IndexedDB-20150108/#widl-IDBIndex-count-IDBRequest-any-key
  count(k) {
    confirmActiveTransaction(this);
    let key;
    if (k === null) {
      key = void 0;
    }
    if (k !== void 0 && !(k instanceof FDBKeyRange)) {
      key = FDBKeyRange.only(valueToKey(k));
    }
    if (k instanceof FDBKeyRange) {
      key = k;
    }
    return this.objectStore.transaction._execRequestAsync({
      operation: async () => {
        return (await this._rawIndex._getAllRecords(key, void 0)).length;
      },
      source: this
    });
  }
  toString() {
    return "[object IDBIndex]";
  }
}
let Event$1 = class Event2 {
  constructor(type, eventInitDict = {}) {
    __publicField(this, "eventPath", []);
    __publicField(this, "type");
    __publicField(this, "NONE", 0);
    __publicField(this, "CAPTURING_PHASE", 1);
    __publicField(this, "AT_TARGET", 2);
    __publicField(this, "BUBBLING_PHASE", 3);
    // Flags
    __publicField(this, "propagationStopped", false);
    __publicField(this, "immediatePropagationStopped", false);
    __publicField(this, "canceled", false);
    __publicField(this, "initialized", true);
    __publicField(this, "dispatched", false);
    __publicField(this, "target", null);
    __publicField(this, "currentTarget", null);
    __publicField(this, "eventPhase", 0);
    __publicField(this, "defaultPrevented", false);
    __publicField(this, "isTrusted", false);
    __publicField(this, "timeStamp", Date.now());
    __publicField(this, "bubbles");
    __publicField(this, "cancelable");
    this.type = type;
    this.bubbles = eventInitDict.bubbles !== void 0 ? eventInitDict.bubbles : false;
    this.cancelable = eventInitDict.cancelable !== void 0 ? eventInitDict.cancelable : false;
  }
  preventDefault() {
    if (this.cancelable) {
      this.canceled = true;
    }
  }
  stopPropagation() {
    this.propagationStopped = true;
  }
  stopImmediatePropagation() {
    this.propagationStopped = true;
    this.immediatePropagationStopped = true;
  }
};
const stopped = (event, listener) => {
  return event.immediatePropagationStopped || event.eventPhase === event.CAPTURING_PHASE && listener.capture === false || event.eventPhase === event.BUBBLING_PHASE && listener.capture === true;
};
const invokeEventListeners = (event, obj) => {
  event.currentTarget = obj;
  let thrownError = void 0;
  for (const listener of obj.listeners.slice()) {
    if (event.type !== listener.type || stopped(event, listener)) {
      continue;
    }
    try {
      listener.callback.call(event.currentTarget, event);
    } catch (e) {
      if (thrownError === void 0) {
        thrownError = e;
      }
    }
  }
  const typeToProp = {
    abort: "onabort",
    blocked: "onblocked",
    complete: "oncomplete",
    error: "onerror",
    success: "onsuccess",
    upgradeneeded: "onupgradeneeded",
    versionchange: "onversionchange"
  };
  const prop = typeToProp[event.type];
  if (prop === void 0) {
    throw new Error(`Unknown event type: "${event.type}"`);
  }
  const callback = event.currentTarget[prop];
  if (callback) {
    const listener = {
      callback,
      capture: false,
      type: event.type
    };
    if (!stopped(event, listener)) {
      try {
        listener.callback.call(event.currentTarget, event);
      } catch (e) {
        if (thrownError === void 0) {
          thrownError = e;
        }
      }
    }
  }
  if (thrownError !== void 0) {
    throw thrownError;
  }
};
class FakeEventTarget {
  constructor() {
    __publicField(this, "listeners", []);
    // These will be overridden in individual subclasses and made not readonly
    __publicField(this, "onabort");
    __publicField(this, "onblocked");
    __publicField(this, "oncomplete");
    __publicField(this, "onerror");
    __publicField(this, "onsuccess");
    __publicField(this, "onupgradeneeded");
    __publicField(this, "onversionchange");
  }
  addEventListener(type, callback, capture = false) {
    this.listeners.push({
      callback,
      capture,
      type
    });
  }
  removeEventListener(type, callback, capture = false) {
    const i = this.listeners.findIndex((listener) => {
      return listener.type === type && listener.callback === callback && listener.capture === capture;
    });
    this.listeners.splice(i, 1);
  }
  // http://www.w3.org/TR/dom/#dispatching-events
  dispatchEvent(event) {
    if (event.dispatched || !event.initialized) {
      throw new InvalidStateError("The object is in an invalid state.");
    }
    event.isTrusted = false;
    event.dispatched = true;
    event.target = this;
    event.eventPhase = event.CAPTURING_PHASE;
    for (const obj of event.eventPath) {
      if (!event.propagationStopped) {
        invokeEventListeners(event, obj);
      }
    }
    event.eventPhase = event.AT_TARGET;
    if (!event.propagationStopped) {
      invokeEventListeners(event, event.target);
    }
    if (event.bubbles) {
      event.eventPath.reverse();
      event.eventPhase = event.BUBBLING_PHASE;
      for (const obj of event.eventPath) {
        if (!event.propagationStopped) {
          invokeEventListeners(event, obj);
        }
      }
    }
    event.dispatched = false;
    event.eventPhase = event.NONE;
    event.currentTarget = null;
    if (event.canceled) {
      return false;
    }
    return true;
  }
}
class FDBRequest extends FakeEventTarget {
  constructor() {
    super(...arguments);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    __publicField(this, "_result", null);
    __publicField(this, "_error", null);
    __publicField(this, "source", null);
    __publicField(this, "transaction", null);
    __publicField(this, "readyState", "pending");
    __publicField(this, "onsuccess", null);
    __publicField(this, "onerror", null);
  }
  get error() {
    if (this.readyState === "pending") {
      throw new InvalidStateError();
    }
    return this._error;
  }
  set error(value) {
    this._error = value;
  }
  get result() {
    if (this.readyState === "pending") {
      throw new InvalidStateError();
    }
    return this._result;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  set result(value) {
    this._result = value;
  }
  toString() {
    return "[object IDBRequest]";
  }
}
class FDBOpenDBRequest extends FDBRequest {
  constructor() {
    super(...arguments);
    __publicField(this, "onupgradeneeded", null);
    __publicField(this, "onblocked", null);
  }
  toString() {
    return "[object IDBOpenDBRequest]";
  }
}
class FDBVersionChangeEvent extends Event$1 {
  constructor(type, parameters = {}) {
    super(type);
    __publicField(this, "newVersion");
    __publicField(this, "oldVersion");
    this.newVersion = parameters.newVersion !== void 0 ? parameters.newVersion : null;
    this.oldVersion = parameters.oldVersion !== void 0 ? parameters.oldVersion : 0;
  }
  toString() {
    return "[object IDBVersionChangeEvent]";
  }
}
function deserializeQuery(range) {
  if (typeof range === "object" && "lower" in range) {
    const { lower, upper, lowerOpen, upperOpen } = range;
    if (lower === void 0 && upper === void 0) return void 0;
    if (lower === void 0) {
      return IDBKeyRange.upperBound(upper, upperOpen);
    }
    if (upper === void 0) {
      return IDBKeyRange.lowerBound(lower, lowerOpen);
    }
    return IDBKeyRange.bound(lower, upper, lowerOpen, upperOpen);
  }
  return range;
}
async function performWriteOperation(change, store) {
  switch (change.method) {
    case "add": {
      const { value, key } = change.params;
      return store.add(value, key);
    }
    case "clear": {
      return store.clear();
    }
    case "delete": {
      const { query } = change.params;
      const out = store.delete(deserializeQuery(query));
      return out;
    }
    case "put": {
      const { value, key } = change.params;
      return store.put(value, key);
    }
    case "replace": {
      const { key, index, value } = change.params;
      const request = store.index(index).openCursor(key);
      return await new Promise((res) => {
        request.onsuccess = () => {
          res(request.result.update(value));
        };
      });
    }
  }
}
const openedDbs = {};
const openDatabaseHandler = async (docId, { name, version, doOnUpgrade }) => {
  const req = indexedDB.open(`${docId}:${name}`, version);
  req.onupgradeneeded = () => {
    const db = req.result;
    for (const upgradeAction of doOnUpgrade) {
      switch (upgradeAction.method) {
        case "createObjectStore": {
          const { name: name2, options } = upgradeAction.params;
          const store = db.createObjectStore(name2, options);
          handleObjectStoreActions(
            upgradeAction.params.doOnUpgrade,
            store
          );
          break;
        }
        case "deleteObjectStore": {
          const { name: name2 } = upgradeAction.params;
          db.deleteObjectStore(name2);
          break;
        }
        case "modifyObjectStore": {
          const { name: name2, doOnUpgrade: doOnUpgrade2 } = upgradeAction.params;
          const store = req.transaction.objectStore(name2);
          handleObjectStoreActions(doOnUpgrade2, store);
        }
      }
    }
  };
  return new Promise((res, rej) => {
    req.onsuccess = () => {
      const db = req.result;
      let openedDb = openedDbs[`${docId}:${name}`];
      if (openedDb) {
        openedDb.db.close();
      }
      if (!openedDb) {
        openedDbs[`${docId}:${name}`] = openedDb = {
          db,
          count: 0
        };
      }
      openedDb.count++;
      const names = db.objectStoreNames;
      if (names.length === 0) {
        res({ objectStores: [] });
        return;
      }
      const out = [];
      const tx = db.transaction(names, "readonly");
      for (const name2 of names) {
        const store = tx.objectStore(name2);
        out.push({
          name: name2,
          parameters: {
            keyPath: store.keyPath,
            autoIncrement: store.autoIncrement
          },
          indexes: [...store.indexNames].map((name3) => {
            const index = store.index(name3);
            return {
              name: name3,
              parameters: {
                multiEntry: index.multiEntry,
                unique: index.unique
              },
              keyPath: index.keyPath
            };
          })
        });
      }
      res({ objectStores: out });
    };
    req.onerror = () => {
      rej(req.error);
    };
  });
};
function handleObjectStoreActions(doOnUpgrade, store) {
  for (const ua of doOnUpgrade) {
    switch (ua.method) {
      case "renameObjectStore": {
        const { newName } = ua.params;
        store.name = newName;
        break;
      }
      case "createIndex": {
        const { name, keyPath, options } = ua.params;
        store.createIndex(name, keyPath, options);
        break;
      }
      case "deleteIndex": {
        const { name } = ua.params;
        store.deleteIndex(name);
        break;
      }
      case "modifyIndex": {
        const { name, newName } = ua.params;
        store.index(name).name = newName;
        break;
      }
      default: {
        performWriteOperation(ua, store).then((opReq) => {
          opReq.onerror = (e) => {
            console.warn("error while executing write op: ", e);
            e.preventDefault();
          };
        });
        break;
      }
    }
  }
}
function requestToPromise(request) {
  return new Promise((res, rej) => {
    const onSuccess = (e) => {
      res(e.target.result);
      request.removeEventListener("success", onSuccess);
    };
    request.addEventListener("success", onSuccess);
    const onError = (e) => {
      rej(e.target.error);
      request.removeEventListener("error", onError);
    };
    request.addEventListener("error", onError);
  });
}
const executeReadHandler = async (docId, req) => {
  const { call: call2, dbName, store } = req;
  let dbRecord = void 0;
  let dbs = void 0;
  let openedNewConn = false;
  if (openedDbs[`${docId}:${dbName}`]) {
    dbRecord = openedDbs[`${docId}:${dbName}`].db;
  } else {
    dbs = await indexedDB.databases();
  }
  if (dbs !== void 0 && dbs.some((v) => v.name === `${docId}:${dbName}`)) {
    dbRecord = await new Promise((res) => {
      const request = indexedDB.open(`${docId}:${dbName}`);
      request.onsuccess = () => res(request.result);
    });
    openedNewConn = true;
  }
  let tx = void 0;
  try {
    if (dbRecord !== void 0) tx = dbRecord.transaction(store, "readonly");
  } catch (e) {
    dbRecord = void 0;
    console.error("Unexpected error", e, req);
  }
  if (dbRecord === void 0 || tx === void 0) {
    switch (call2.method) {
      case "getAllKeys":
        return [];
      case "getAllRecords":
        return [[], []];
      case "getAllRecordsFromIndex":
        return [[], []];
      case "getNextFromCursor":
        return void 0;
    }
  }
  tx.onabort = () => {
    if (openedNewConn) {
      dbRecord.close();
    }
  };
  tx.onerror = () => {
    if (openedNewConn) {
      dbRecord.close();
    }
  };
  tx.oncomplete = () => {
    if (openedNewConn) {
      dbRecord.close();
    }
  };
  const objStore = tx.objectStore(store);
  if (call2.method === "getNextFromCursor") {
    const {
      range: serializedRange,
      direction,
      indexName,
      currPrimaryKey,
      prevPrimaryKey,
      justKeys
    } = call2.params;
    const range = serializedRange ? deserializeQuery$1(serializedRange) : void 0;
    const parentObject = indexName ? objStore.index(indexName) : objStore;
    const cursorRequest = justKeys ? parentObject.openKeyCursor(range, direction) : parentObject.openCursor(
      range,
      direction
    );
    let cursor = await requestToPromise(cursorRequest);
    if (cursor === null) {
      return void 0;
    }
    if (currPrimaryKey !== void 0 && cmp(cursor.primaryKey, currPrimaryKey) >= 0) ;
    else if (currPrimaryKey !== void 0) {
      cursor.continuePrimaryKey(
        direction.includes("next") ? range.lower : range.upper,
        currPrimaryKey
      );
      cursor = await requestToPromise(cursorRequest);
    } else if (cursor.primaryKey === prevPrimaryKey) {
      cursor.advance(1);
      cursor = await requestToPromise(cursorRequest);
    } else if (prevPrimaryKey !== void 0) {
      cursor.continuePrimaryKey(
        direction.includes("next") ? range.lower : range.upper,
        prevPrimaryKey
      );
      cursor = await requestToPromise(cursorRequest);
      cursor == null ? void 0 : cursor.advance(1);
      cursor = await requestToPromise(cursorRequest);
    }
    if (cursor === null) {
      return void 0;
    }
    return {
      key: cursor.key,
      value: "value" in cursor ? cursor.value : void 0,
      primaryKey: cursor.primaryKey
    };
  } else if (call2.method === "getAllRecords") {
    const req1 = requestToPromise(
      methodToRequest(
        {
          method: "getAll",
          params: call2.params
        },
        objStore
      )
    );
    const req2 = requestToPromise(
      methodToRequest(
        { method: "getAllKeys", params: call2.params },
        objStore
      )
    );
    return Promise.all([req1, req2]);
  } else if (call2.method === "getAllRecordsFromIndex") {
    const req1 = methodToRequest(
      {
        method: "getAllFromIndex",
        params: call2.params
      },
      objStore
    );
    const req2 = methodToRequest(
      { method: "getAllKeysFromIndex", params: call2.params },
      objStore
    );
    return Promise.all([
      requestToPromise(req1),
      requestToPromise(req2)
    ]);
  } else {
    const request = methodToRequest(call2, objStore);
    return requestToPromise(request);
  }
};
function methodToRequest(call2, objStore) {
  switch (call2.method) {
    case "getAll": {
      const { query, count } = call2.params;
      return objStore.getAll(
        query !== void 0 ? deserializeQuery$1(query) : query,
        count
      );
    }
    case "getAllKeys": {
      const { query, count } = call2.params;
      return objStore.getAllKeys(
        query ? deserializeQuery$1(query) : null,
        count
      );
    }
    case "getAllKeysFromIndex": {
      const { indexName, query, count } = call2.params;
      const index = objStore.index(indexName);
      return index.getAllKeys(
        query ? deserializeQuery$1(query) : null,
        count
      );
    }
    case "getAllFromIndex": {
      const { indexName, query, count } = call2.params;
      const index = objStore.index(indexName);
      return index.getAll(query ? deserializeQuery$1(query) : null, count);
    }
  }
}
const waitForOthersClosedDelete = async (databases2, name, openDatabases, cb, port) => {
  const anyOpen = openDatabases.some((openDatabase2) => {
    return !openDatabase2._closed && !openDatabase2._closePending;
  });
  if (anyOpen) {
    queueTask(async () => {
      await waitForOthersClosedDelete(
        databases2,
        name,
        openDatabases,
        cb,
        port
      );
    });
    return;
  }
  await call(port, "deleteDatabase", { name });
  databases2.delete(name);
  cb(null);
};
const deleteDatabase = async (databases2, name, request, cb, port) => {
  try {
    const db = databases2.get(name);
    if (db === void 0) {
      await call(port, "deleteDatabase", { name });
      cb(null);
      return;
    }
    db.deletePending = true;
    const openDatabases = db.connections.filter(
      (connection) => {
        return !connection._closed && !connection._closePending;
      }
    );
    for (const openDatabase2 of openDatabases) {
      if (!openDatabase2._closePending) {
        const event = new FDBVersionChangeEvent("versionchange", {
          newVersion: null,
          oldVersion: db.version
        });
        openDatabase2.dispatchEvent(event);
      }
    }
    const anyOpen = openDatabases.some((openDatabase3) => {
      return !openDatabase3._closed && !openDatabase3._closePending;
    });
    if (request && anyOpen) {
      const event = new FDBVersionChangeEvent("blocked", {
        newVersion: null,
        oldVersion: db.version
      });
      request.dispatchEvent(event);
    }
    waitForOthersClosedDelete(databases2, name, openDatabases, cb, port);
  } catch (err) {
    cb(err instanceof Error ? err : new Error(String(err)));
  }
};
const runVersionchangeTransaction = (connection, version, request, cb) => {
  connection._runningVersionchangeTransaction = true;
  const oldVersion = connection.version;
  const openDatabases = connection._rawDatabase.connections.filter(
    (otherDatabase) => {
      return connection !== otherDatabase;
    }
  );
  for (const openDatabase2 of openDatabases) {
    if (!openDatabase2._closed && !openDatabase2._closePending) {
      const event = new FDBVersionChangeEvent("versionchange", {
        newVersion: version,
        oldVersion
      });
      openDatabase2.dispatchEvent(event);
    }
  }
  const anyOpen = openDatabases.some((openDatabase3) => {
    return !openDatabase3._closed && !openDatabase3._closePending;
  });
  if (anyOpen) {
    const event = new FDBVersionChangeEvent("blocked", {
      newVersion: version,
      oldVersion
    });
    request.dispatchEvent(event);
  }
  const waitForOthersClosed = () => {
    const anyOpen2 = openDatabases.some((openDatabase2) => {
      return !openDatabase2._closed && !openDatabase2._closePending;
    });
    if (anyOpen2) {
      queueTask(waitForOthersClosed);
      return;
    }
    connection._rawDatabase.version = version;
    connection.version = version;
    const transaction = connection.transaction(
      Array.from(connection.objectStoreNames),
      "versionchange",
      true
    );
    request.result = connection;
    request.readyState = "done";
    request.transaction = transaction;
    transaction._rollbackLog.push(() => {
      connection._rawDatabase.version = oldVersion;
      connection.version = oldVersion;
    });
    const event = new FDBVersionChangeEvent("upgradeneeded", {
      newVersion: version,
      oldVersion
    });
    try {
      request.dispatchEvent(event);
    } catch (e) {
      console.error("Error in dispatching upgrade event", e);
      cb(new AbortError());
    }
    transaction.addEventListener("error", (e) => {
      connection._runningVersionchangeTransaction = false;
      console.error(
        "error in versionchange transaction - not sure if anything needs to be done here",
        e.target.error.name
      );
    });
    transaction.addEventListener("abort", () => {
      connection._runningVersionchangeTransaction = false;
      request.transaction = null;
      queueTask(() => {
        cb(new AbortError());
      });
    });
    transaction.addEventListener("complete", () => {
      connection._runningVersionchangeTransaction = false;
      request.transaction = null;
      queueTask(() => {
        if (connection._closePending) {
          cb(new AbortError());
        } else {
          cb(null);
        }
      });
    });
  };
  waitForOthersClosed();
};
const openDatabase = async (databases2, name, version, request, cb, port) => {
  var _a;
  const dbInfo = await call(port, "getDbInfo", void 0);
  let oldVersion = (_a = dbInfo.find((v) => v.name == name)) == null ? void 0 : _a.version;
  let db;
  if (oldVersion === void 0) {
    oldVersion = 0;
    db = new Database(name, 0, port);
    databases2.set(name, db);
  } else {
    db = databases2.get(name) ?? new Database(name, oldVersion, port);
    await db.sync();
  }
  if (version === void 0) {
    version = db.version !== 0 ? db.version : 1;
  }
  if (db.version > version) {
    return cb(new VersionError());
  }
  const connection = new FDBDatabase(db);
  if (db.version < version) {
    runVersionchangeTransaction(connection, version, request, (err) => {
      if (err) {
        try {
          connection.close();
        } catch {
        }
        return cb(err);
      }
      cb(null, connection);
    });
  } else {
    const upgradeActions = [];
    await callOpenDatabase(connection, upgradeActions);
    cb(null, connection);
  }
};
const fifoDbQueue = /* @__PURE__ */ new Set();
let running = void 0;
function maybeRunNext() {
  if (running === void 0) {
    const next = fifoDbQueue[Symbol.iterator]().next();
    if (next.done) {
      return;
    }
    running = next.value;
    queueTask(() => {
      running().finally(() => {
        fifoDbQueue.delete(running);
        running = void 0;
        queueTask(maybeRunNext);
      });
    });
  }
}
function addToQueue(fn) {
  fifoDbQueue.add(fn);
  maybeRunNext();
}
class FDBFactory {
  constructor(port) {
    __publicField(this, "_port");
    __publicField(this, "cmp", cmp);
    __publicField(this, "_databases", /* @__PURE__ */ new Map());
    this._port = port;
  }
  // http://www.w3.org/TR/2015/REC-IndexedDB-20150108/#widl-IDBFactory-deleteDatabase-IDBOpenDBRequest-DOMString-name
  deleteDatabase(name) {
    const request = new FDBOpenDBRequest();
    request.source = null;
    const reqPromise = requestToPromise(
      request
    );
    addToQueue(async () => {
      const db = this._databases.get(name);
      const oldVersion = db !== void 0 ? db.version : 0;
      deleteDatabase(
        this._databases,
        name,
        request,
        (err) => {
          if (err) {
            request.error = new DOMException(err.message, err.name);
            request.readyState = "done";
            const event = new Event$1("error", {
              bubbles: true,
              cancelable: true
            });
            event.eventPath = [];
            request.dispatchEvent(event);
            return;
          }
          request.result = void 0;
          request.readyState = "done";
          const event2 = new FDBVersionChangeEvent("success", {
            newVersion: null,
            oldVersion
          });
          request.dispatchEvent(event2);
        },
        this._port
      );
      await reqPromise;
    });
    return request;
  }
  // http://www.w3.org/TR/2015/REC-IndexedDB-20150108/#widl-IDBFactory-open-IDBOpenDBRequest-DOMString-name-unsigned-long-long-version
  open(name, version) {
    if (arguments.length > 1 && version !== void 0) {
      version = enforceRange(version, "MAX_SAFE_INTEGER");
    }
    if (version === 0) {
      throw new TypeError("Database version cannot be 0");
    }
    const request = new FDBOpenDBRequest();
    request.source = null;
    const reqPromise = requestToPromise(
      request
    );
    addToQueue(async () => {
      openDatabase(
        this._databases,
        name,
        version,
        request,
        (err, connection) => {
          if (err) {
            request.result = void 0;
            request.readyState = "done";
            request.error = new DOMException(err.message, err.name);
            const event = new Event$1("error", {
              bubbles: true,
              cancelable: true
            });
            event.eventPath = [];
            if (request.transaction) {
              request.transaction.error = request.error;
            }
            request.dispatchEvent(event);
            return;
          }
          request.result = connection;
          request.readyState = "done";
          const event2 = new Event$1("success");
          event2.eventPath = [];
          request.dispatchEvent(event2);
        },
        this._port
      );
      await reqPromise;
    });
    return request;
  }
  // https://w3c.github.io/IndexedDB/#dom-idbfactory-databases
  async databases() {
    const out = await call(
      this._port,
      "getDbInfo",
      void 0
    );
    return out;
  }
  toString() {
    return "[object IDBFactory]";
  }
}
async function callOpenDatabase(connection, upgradeActions) {
  const db = connection._rawDatabase;
  const res = await call(db._port, "openDatabase", {
    name: connection.name,
    version: connection.version,
    doOnUpgrade: upgradeActions
  });
  for (const storeData of res.objectStores) {
    let store = db.rawObjectStores.get(storeData.name);
    if (store === void 0) {
      store = new ObjectStore(
        db,
        storeData.name,
        storeData.parameters.keyPath ?? null,
        storeData.parameters.autoIncrement ?? false
      );
      connection.objectStoreNames._push(storeData.name);
      connection.objectStoreNames._sort();
      db.rawObjectStores.set(storeData.name, store);
    }
    for (const index of storeData.indexes) {
      const rawIndex = new Index(
        store,
        index.name,
        index.keyPath,
        index.parameters.multiEntry ?? false,
        index.parameters.unique ?? false
      );
      rawIndex.initialized = true;
      store == null ? void 0 : store.rawIndexes.set(index.name, rawIndex);
    }
  }
}
class FDBTransaction extends FakeEventTarget {
  constructor(storeNames, mode, db) {
    super();
    __publicField(this, "_state", "active");
    __publicField(this, "_started", false);
    __publicField(this, "_rollbackLog", []);
    __publicField(this, "_writeActions");
    __publicField(this, "_upgradeActions", []);
    __publicField(this, "_objectStoresCache", /* @__PURE__ */ new Map());
    __publicField(this, "objectStoreNames");
    __publicField(this, "mode");
    __publicField(this, "db");
    __publicField(this, "error", null);
    __publicField(this, "onabort", null);
    __publicField(this, "oncomplete", null);
    __publicField(this, "onerror", null);
    __publicField(this, "_scope");
    __publicField(this, "_requests", []);
    this._scope = new Set(storeNames);
    this.mode = mode;
    this.db = db;
    this._writeActions = {
      dbName: db.name,
      ops: storeNames.reduce(
        (prev, curr) => {
          prev[curr] = [];
          return prev;
        },
        {}
      )
    };
    this.objectStoreNames = new FakeDOMStringList(
      ...Array.from(this._scope).sort()
    );
  }
  // http://www.w3.org/TR/2015/REC-IndexedDB-20150108/#dfn-steps-for-aborting-a-transaction
  _abort(errName) {
    for (const f of this._rollbackLog.reverse()) {
      f();
    }
    if (errName === "AbortError") {
      this.error = new AbortError();
    } else if (errName !== null) {
      const e = new DOMException(void 0, errName);
      this.error = e;
    }
    for (const { request } of this._requests) {
      if (request.readyState !== "done") {
        request.readyState = "done";
        if (request.source) {
          request.result = void 0;
          request.error = new AbortError();
          const event = new Event$1("error", {
            bubbles: true,
            cancelable: true
          });
          event.eventPath = [this.db, this];
          request.dispatchEvent(event);
        }
      }
    }
    this._upgradeActions = [];
    this._writeActions = void 0;
    queueTask(() => {
      this._state = "aborting";
      const event = new Event$1("abort", {
        bubbles: true,
        cancelable: false
      });
      event.eventPath = [this.db];
      this.dispatchEvent(event);
      this._state = "finished";
    });
    this._state = "finished";
  }
  abort() {
    if (this._state === "committing" || this._state === "finished") {
      throw new InvalidStateError();
    }
    this._state = "active";
    this._abort(null);
  }
  // http://w3c.github.io/IndexedDB/#dom-idbtransaction-objectstore
  objectStore(name, _justCreated = false) {
    if (this._state !== "active") {
      throw new InvalidStateError();
    }
    const objectStore = this._objectStoresCache.get(name);
    if (objectStore !== void 0) {
      return objectStore;
    }
    const rawObjectStore = this.db._rawDatabase.rawObjectStores.get(name);
    if (!this._scope.has(name) || rawObjectStore === void 0) {
      throw new NotFoundError();
    }
    let writeActionArr = void 0;
    if (this.mode === "versionchange") {
      const found = this._upgradeActions.findLast(
        (v) => (v.method === "createObjectStore" || v.method === "modifyObjectStore") && v.params.name === name
      );
      if (found) {
        writeActionArr = found.params.doOnUpgrade;
      } else {
        writeActionArr = [];
        this._upgradeActions.push({
          method: "modifyObjectStore",
          params: {
            name,
            doOnUpgrade: writeActionArr
          }
        });
      }
    }
    if (writeActionArr === void 0) {
      writeActionArr = this._writeActions.ops[name];
    }
    const objectStore2 = new FDBObjectStore(
      this,
      rawObjectStore,
      writeActionArr,
      _justCreated
    );
    this._objectStoresCache.set(name, objectStore2);
    return objectStore2;
  }
  // http://www.w3.org/TR/2015/REC-IndexedDB-20150108/#dfn-steps-for-asynchronously-executing-a-request
  _execRequestAsync(obj) {
    const source = obj.source;
    const operation = obj.operation;
    let request = Object.hasOwn(obj, "request") ? obj.request : null;
    if (this._state !== "active") {
      throw new TransactionInactiveError();
    }
    if (!request) {
      if (!source) {
        request = new FDBRequest();
      } else {
        request = new FDBRequest();
        request.source = source;
        request.transaction = "transaction" in source ? source.transaction : null;
      }
    }
    this._requests.push({
      operation,
      request
    });
    return request;
  }
  async _start() {
    this._started = true;
    let operation;
    let request;
    while (this._requests.length > 0) {
      const r = this._requests.shift();
      if (r && r.request.readyState !== "done") {
        request = r.request;
        operation = r.operation;
        break;
      }
    }
    if (request && operation) {
      if (!request.source) {
        await operation();
      } else {
        let defaultAction;
        let event;
        try {
          const result = await operation();
          request.readyState = "done";
          request.result = result;
          request.error = void 0;
          if (this._state === "inactive") {
            this._state = "active";
          }
          event = new Event$1("success", {
            bubbles: false,
            cancelable: false
          });
        } catch (e) {
          const err = e;
          request.readyState = "done";
          request.result = void 0;
          request.error = err;
          if (this._state === "inactive") {
            this._state = "active";
          }
          event = new Event$1("error", {
            bubbles: true,
            cancelable: true
          });
          defaultAction = this._abort.bind(this, err.name);
        }
        const timeoutForInactive = new Promise(
          (res) => setTimeout(res, 0)
        );
        try {
          event.eventPath = [this.db, this];
          request.dispatchEvent(event);
          await timeoutForInactive;
        } catch (err) {
          await timeoutForInactive;
          if (this._state !== "committing") {
            this._abort("AbortError");
          } else {
            this._state = "inactive";
            queueTask(this._start.bind(this));
            throw err;
          }
        }
        if (!event.canceled) {
          if (defaultAction) {
            defaultAction();
          }
        }
      }
      this._state = "inactive";
      queueTask(this._start.bind(this));
      return;
    }
    if (this._state === "aborting") {
      this._state = "finished";
    }
    if (this._state !== "finished") {
      for (const objectStore of this._objectStoresCache.values()) {
        objectStore._rawObjectStore.cleanupAfterCompletedTransaction();
      }
      this._state = "finished";
      if (!this.error) {
        if (this.mode === "versionchange") {
          await callOpenDatabase(this.db, this._upgradeActions);
        } else if (this._writeActions && Object.values(this._writeActions.ops).some(
          (v) => v.length !== 0
        )) {
          await call(
            this.db._rawDatabase._port,
            "executeTransaction",
            this._writeActions
          );
        }
        const event = new Event$1("complete");
        this.dispatchEvent(event);
      }
    }
  }
  commit() {
    if (this._state !== "active") {
      throw new TransactionInactiveError();
    }
    this._state = "committing";
  }
  toString() {
    return "[object IDBRequest]";
  }
}
const confirmActiveVersionchangeTransaction = (database) => {
  const transactions = database._rawDatabase.transactions.filter((tx) => {
    return tx.mode === "versionchange";
  });
  const transaction = transactions[transactions.length - 1];
  if (!transaction || transaction._state === "finished") {
    throw new InvalidStateError();
  }
  if (transaction._state !== "active") {
    throw new TransactionInactiveError();
  }
  if (!database._runningVersionchangeTransaction) {
    throw new InvalidStateError();
  }
  return transaction;
};
const closeConnection = async (connection) => {
  connection._closePending = true;
  const transactionsComplete = connection._rawDatabase.transactions.every(
    (transaction) => {
      return transaction._state === "finished";
    }
  );
  if (transactionsComplete) {
    connection._closed = true;
    await call(
      connection._rawDatabase._port,
      "closeDatabase",
      { name: connection.name }
    );
    connection._rawDatabase.connections = connection._rawDatabase.connections.filter((otherConnection) => {
      return connection !== otherConnection;
    });
  } else {
    queueTask(() => {
      closeConnection(connection);
    });
  }
};
class FDBDatabase extends FakeEventTarget {
  constructor(rawDatabase) {
    super();
    __publicField(this, "_closePending", false);
    __publicField(this, "_closed", false);
    __publicField(this, "_runningVersionchangeTransaction", false);
    __publicField(this, "_rawDatabase");
    __publicField(this, "name");
    __publicField(this, "version");
    __publicField(this, "objectStoreNames");
    this._rawDatabase = rawDatabase;
    this._rawDatabase.connections.push(this);
    this.name = rawDatabase.name;
    this.version = rawDatabase.version;
    this.objectStoreNames = new FakeDOMStringList(
      ...Array.from(rawDatabase.rawObjectStores.keys()).sort()
    );
  }
  // http://w3c.github.io/IndexedDB/#dom-idbdatabase-createobjectstore
  createObjectStore(name, options = {}) {
    if (name === void 0) {
      throw new TypeError();
    }
    const transaction = confirmActiveVersionchangeTransaction(this);
    const keyPath = options !== null && options.keyPath !== void 0 ? options.keyPath : null;
    const autoIncrement = options !== null && options.autoIncrement !== void 0 ? options.autoIncrement : false;
    if (keyPath !== null) {
      validateKeyPath(keyPath);
    }
    if (this._rawDatabase.rawObjectStores.has(name)) {
      throw new ConstraintError();
    }
    if (autoIncrement && (keyPath === "" || Array.isArray(keyPath))) {
      throw new InvalidAccessError();
    }
    const objectStoreNames = [...this.objectStoreNames];
    transaction._rollbackLog.push(() => {
      const objectStore = this._rawDatabase.rawObjectStores.get(name);
      if (objectStore) {
        objectStore.deleted = true;
      }
      this.objectStoreNames = new FakeDOMStringList(...objectStoreNames);
      transaction._scope.delete(name);
      this._rawDatabase.rawObjectStores.delete(name);
    });
    const rawObjectStore = new ObjectStore(
      this._rawDatabase,
      name,
      keyPath,
      autoIncrement
    );
    this.objectStoreNames._push(name);
    this.objectStoreNames._sort();
    this._rawDatabase.rawObjectStores.set(name, rawObjectStore);
    transaction._scope.add(name);
    transaction.objectStoreNames = new FakeDOMStringList(
      ...this.objectStoreNames
    );
    transaction._upgradeActions.push({
      method: "createObjectStore",
      params: {
        name,
        options: options ?? {},
        doOnUpgrade: []
      }
    });
    return transaction.objectStore(name, true);
  }
  deleteObjectStore(name) {
    if (name === void 0) {
      throw new TypeError();
    }
    const transaction = confirmActiveVersionchangeTransaction(this);
    const store = this._rawDatabase.rawObjectStores.get(name);
    if (store === void 0) {
      throw new NotFoundError();
    }
    this.objectStoreNames = new FakeDOMStringList(
      ...Array.from(this.objectStoreNames).filter((objectStoreName) => {
        return objectStoreName !== name;
      })
    );
    transaction.objectStoreNames = new FakeDOMStringList(
      ...this.objectStoreNames
    );
    transaction._upgradeActions.push({
      method: "deleteObjectStore",
      params: {
        name
      }
    });
    transaction._rollbackLog.push(() => {
      store.deleted = false;
      this._rawDatabase.rawObjectStores.set(name, store);
      this.objectStoreNames._push(name);
      this.objectStoreNames._sort();
    });
    store.deleted = true;
    this._rawDatabase.rawObjectStores.delete(name);
    transaction._objectStoresCache.delete(name);
  }
  transaction(storeNames, mode, internalRequest = false) {
    mode = mode !== void 0 ? mode : "readonly";
    const hasActiveVersionchange = this._rawDatabase.transactions.some(
      (transaction) => {
        return transaction._state === "active" && transaction.mode === "versionchange" && transaction.db === this;
      }
    );
    if (hasActiveVersionchange) {
      throw new InvalidStateError();
    }
    if (this._closePending) {
      throw new InvalidStateError();
    }
    if (!Array.isArray(storeNames)) {
      storeNames = [storeNames];
    }
    if (storeNames.length === 0 && mode !== "versionchange") {
      throw new InvalidAccessError();
    }
    for (const storeName of storeNames) {
      if (!this.objectStoreNames.contains(storeName)) {
        throw new NotFoundError(
          "No objectStore named " + storeName + " in this database"
        );
      }
    }
    if (mode !== "readonly" && mode !== "readwrite") {
      if (!(internalRequest && mode === "versionchange"))
        throw new TypeError("Invalid mode: " + mode);
    }
    const tx = new FDBTransaction(storeNames, mode, this);
    this._rawDatabase.transactions.push(tx);
    this._rawDatabase.processTransactions();
    return tx;
  }
  close() {
    closeConnection(this);
    if (this._runningVersionchangeTransaction) {
      throw new AbortError();
    }
  }
  toString() {
    return "[object IDBDatabase]";
  }
}
const closeDatabaseHandler = async (docId, { name }) => {
  const dbRecord = openedDbs[`${docId}:${name}`];
  if (dbRecord && --dbRecord.count === 0) {
    dbRecord.db.close();
    delete openedDbs[`${docId}:${name}`];
  }
  return null;
};
const deleteDatabaseHandler = async (docId, { name }) => {
  await requestToPromise(indexedDB.deleteDatabase(`${docId}:${name}`));
  return null;
};
const executeTransactionHandler = async (docId, req) => {
  const { dbName, ops: txs } = req;
  const dbRecord = openedDbs[`${docId}:${dbName}`];
  if (dbRecord === void 0) {
    console.error("shouldn't execute txs on not opened databases");
  }
  const db = dbRecord.db;
  let tx;
  try {
    tx = db.transaction(Object.keys(txs), "readwrite");
  } catch (e) {
    console.error("Unexpected error while execing tx", e);
    return void 0;
  }
  const promises = [];
  for (const storeName in txs) {
    const changes = txs[storeName];
    const store = tx.objectStore(storeName);
    for (const change of changes) {
      performWriteOperation(change, store).then((opReq) => {
        opReq.onerror = (e) => {
          var _a;
          console.warn(
            "error while executing write op: ",
            change,
            e,
            (_a = e.target) == null ? void 0 : _a.error
          );
          e.preventDefault();
          e.stopPropagation();
        };
      });
    }
    if (changes.length > 0) {
      promises.push(
        new Promise((res, rej) => {
          tx.oncomplete = () => {
            res(void 0);
          };
          tx.onerror = (e) => {
            console.log("ERR ON TX");
            rej(e);
            throw e;
          };
        })
      );
    }
  }
  await Promise.all(promises);
  return void 0;
};
async function databases(docId) {
  const dbs = (await indexedDB.databases()).filter((value) => {
    var _a;
    return (_a = value.name) == null ? void 0 : _a.startsWith(`${docId}:`);
  }).map((value) => {
    var _a;
    return {
      name: (_a = value.name) == null ? void 0 : _a.slice(`${docId}:`.length),
      version: value.version
    };
  });
  return dbs;
}
const getDbInfoHandler = databases;
const getDatabaseStoresHandler = async (docId, { name }) => {
  if (!(await indexedDB.databases()).some(
    (v) => v.name === `${docId}:${name}`
  )) {
    return [];
  }
  {
    const db2 = openedDbs[`${docId}:${name}`];
    if (db2) {
      return idbStoresFromDb(db2.db);
    }
  }
  const db = await requestToPromise(indexedDB.open(`${docId}:${name}`));
  const out = idbStoresFromDb(db);
  db.close();
  return out;
};
function idbStoresFromDb(db) {
  const names = db.objectStoreNames;
  if (names.length === 0) {
    return [];
  }
  const tx = db.transaction(names, "readonly");
  const out = [];
  for (const name of names) {
    const store = tx.objectStore(name);
    const indexes = [];
    for (const indexName of store.indexNames) {
      const idx = store.index(indexName);
      indexes.push({
        name: idx.name,
        keyPath: idx.keyPath,
        multiEntry: idx.multiEntry,
        unique: idx.unique
      });
    }
    out.push({
      name,
      parameters: {
        keyPath: store.keyPath,
        autoIncrement: store.autoIncrement
      },
      indexes
    });
  }
  return out;
}
async function setupIndexedDBMethodHandlersFromPort(port, docId, handlers2) {
  for (const hn in handlers2) {
    const handlerName = hn;
    const handler = handlers2[handlerName];
    handleRequests(
      port,
      handlerName,
      handler.bind(void 0, docId)
    );
  }
}
async function setupIndexedDBMethodHandlers(window2, docId, handlers2) {
  const port = await postMessagePort("indexedDB", window2);
  setupIndexedDBMethodHandlersFromPort(port, docId, handlers2);
}
const handlers = {
  openDatabase: openDatabaseHandler,
  closeDatabase: closeDatabaseHandler,
  deleteDatabase: deleteDatabaseHandler,
  getDbInfo: getDbInfoHandler,
  getDatabaseStores: getDatabaseStoresHandler,
  executeRead: executeReadHandler,
  executeTransaction: executeTransactionHandler
};
async function deleteAllDatabases() {
  const databases2 = await indexedDB.databases();
  for (const dbInfo of databases2) {
    if (dbInfo.name) {
      await requestToPromise(
        indexedDB.deleteDatabase(dbInfo.name)
      );
    }
  }
}
async function overrideIndexedDB() {
  const deletePromise = deleteAllDatabases();
  const port = await getMessagePort("indexedDB");
  await deletePromise;
  const idb = new FDBFactory(port);
  window.indexedDB = idb;
  globalThis.indexedDB = idb;
  window.IDBCursor = FDBCursor;
  window.IDBCursorWithValue = FDBCursorWithValue;
  window.IDBDatabase = FDBDatabase;
  window.IDBFactory = FDBFactory;
  window.IDBIndex = FDBIndex;
  window.IDBKeyRange = FDBKeyRange;
  window.IDBObjectStore = FDBObjectStore;
  window.IDBOpenDBRequest = FDBOpenDBRequest;
  window.IDBRequest = FDBRequest;
  window.IDBTransaction = FDBTransaction;
  window.IDBVersionChangeEvent = FDBVersionChangeEvent;
}
function overrideCookie() {
  clearCookies();
  Object.defineProperty(document, "cookie", {
    set() {
      console.warn("Setting cookies is a no-op in sandboxed mode");
    },
    get() {
      return "";
    }
  });
}
function expireAllCookies(name, paths) {
  const expires = (/* @__PURE__ */ new Date(0)).toUTCString();
  document.cookie = name + "=; expires=" + expires;
  for (let i = 0, l = paths.length; i < l; i++) {
    document.cookie = name + "=; path=" + paths[i] + "; expires=" + expires;
  }
}
function expireActiveCookies(name) {
  const pathname = location.pathname.replace(/\/$/, ""), segments = pathname.split("/"), paths = [];
  for (let i = 0, l = segments.length; i < l; i++) {
    const path = segments.slice(0, i + 1).join("/");
    paths.push(path);
    paths.push(path + "/");
  }
  expireAllCookies(name, paths);
}
async function clearCookies() {
  const cookies = document.cookie.split(";").map((s) => s.trim());
  for (const cookie of cookies) {
    const name = cookie.split("=")[0];
    expireActiveCookies(name);
  }
  if (document.cookie.length != 0) {
    throw new Error(
      "not all cookies were cleared! Cookie: " + document.cookie
    );
  }
}
export {
  FDBCursor as IDBCursor,
  FDBCursorWithValue as IDBCursorWithValue,
  FDBDatabase as IDBDatabase,
  FDBFactory as IDBFactory,
  FDBIndex as IDBIndex,
  FDBKeyRange as IDBKeyRange,
  FDBObjectStore as IDBObjectStore,
  FDBOpenDBRequest as IDBOpenDBRequest,
  FDBRequest as IDBRequest,
  FDBTransaction as IDBTransaction,
  FDBVersionChangeEvent as IDBVersionChangeEvent,
  clearCookies,
  domReplacement,
  domReplacementParentSetup,
  handleProxiedFetchEvent,
  handlers,
  setupIndexedDBMethodHandlers as indexedDBParentSetup,
  localStorageParentSetup,
  overrideCookie,
  overrideIndexedDB,
  overrideLocalStorage,
  proxyFetchEvent,
  sendInitEvent,
  sleep
};
