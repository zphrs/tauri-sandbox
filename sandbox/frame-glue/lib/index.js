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
var _res, _customRespondWith, _FetchEvent_instances, respondWith_fn;
function domReplacement() {
  console.log("HERE");
  window.addEventListener("message", (ev) => {
    if (ev.data != "domReplacementInit") return;
    const port = ev.ports[0];
    port.onmessage = async (ev2) => {
      window.document.documentElement.innerHTML = ev2.data;
      const scripts = document.querySelectorAll("script");
      for (const node of scripts) {
        const script = document.createElement("script");
        for (const attribute of node.attributes) {
          script.setAttribute(attribute.nodeName, attribute.nodeValue);
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
      console.log("Iframe loaded");
      iframe.contentWindow.postMessage("domReplacementInit", "*", [childPort]);
    });
  }
  await waitTillInited;
  return (newDom) => {
    console.log("Posting replacement message");
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
  const request = requestFromObject(data.params.request);
  return new FetchEvent("fetch", {
    request,
    clientId: data.params.clientId,
    replacesClientId: data.params.replacesClientId,
    resultingClientId: data.params.resultingClientId
  });
}
async function requestAsObject(request) {
  const arrayBuffer = await request.arrayBuffer();
  const { url, ...rest } = stringifiableRequestInit(request);
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
  port.postMessage({
    result: {
      arrBuf: await res.arrayBuffer(),
      responseInit: responseToResponseInit(res)
    },
    id
  });
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
  port.postMessage({
    params: {
      request: await requestAsObject(event.request),
      clientId: event.clientId,
      resultingClientId: event.resultingClientId
    },
    id
  });
  return receiveProxiedResponse(port, id);
}
async function sendInitEvent(port) {
  port.postMessage({
    id: "init"
  });
}
async function handleProxiedFetchEvent(port, onfetch) {
  const controller = new AbortController();
  await new Promise((res) => {
    port.addEventListener(
      "message",
      async (ev) => {
        if (ev.data.id == "init") {
          res();
          return;
        }
        const fetchEvent = proxiedRequestToFetchEvent(ev.data);
        fetchEvent.respondWith = async (r) => {
          sendProxiedResponse(port, ev.data.id, await r);
        };
        onfetch(fetchEvent);
      },
      { signal: controller.signal }
    );
    port.start();
  });
  return controller.abort;
}
async function overrideLocalStorage(docId) {
  window.localStorage.clear();
  const {
    port,
    initialStore
  } = await new Promise((res) => {
    window.addEventListener("message", (ev) => {
      if (ev.data != "localStorageInit") return;
      const port2 = ev.ports[0];
      console.log("port");
      port2.addEventListener("message", (event) => {
        const msgData = event.data;
        switch (msgData.call) {
          case "storageEvent":
            initialStore[msgData.key] = msgData.newValue;
            window.dispatchEvent(
              new StorageEvent("storage", {
                ...msgData,
                url: `${origin}/${docId}`
                //   storageArea: ls,
              })
            );
            break;
          case "init":
            res({ port: port2, initialStore: msgData.initialStore });
        }
      });
      port2.start();
    });
    console.log("added msg event listener");
  });
  console.log("Got ls init");
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
async function localStorageParentSetup(docId, iframe) {
  const { port1: port, port2: childPort } = new MessageChannel();
  if (iframe.contentWindow) {
    iframe.contentWindow.postMessage("localStorageInit", "*", [childPort]);
  } else {
    iframe.addEventListener("load", () => {
      var _a;
      (_a = iframe.contentWindow) == null ? void 0 : _a.postMessage("localStorageInit", "*", [childPort]);
    });
  }
  const [initialStore, db] = await new Promise((res2, rej) => {
    const initialLocalStorage = {};
    const DBOpenRequest = window.indexedDB.open(docId);
    DBOpenRequest.addEventListener("success", () => {
      const db2 = DBOpenRequest.result;
      const objStore = db2.transaction(docId).objectStore(docId);
      objStore.openCursor().onsuccess = function() {
        const cursor = this.result;
        if (!cursor) {
          res2([initialLocalStorage, db2]);
          return;
        }
        initialLocalStorage[cursor.key.toString()] = cursor.value;
        cursor.continue();
      };
    });
    DBOpenRequest.addEventListener("upgradeneeded", () => {
      const db2 = DBOpenRequest.result;
      db2.createObjectStore(docId);
    });
    DBOpenRequest.addEventListener("blocked", () => {
      rej("Open request was blocked");
    });
    DBOpenRequest.addEventListener("error", () => {
      rej(DBOpenRequest.error);
    });
  });
  let res;
  const childInitialized = new Promise((r) => {
    res = r;
  });
  port.onmessage = async (event) => {
    const objStore = db.transaction(docId, "readwrite").objectStore(docId);
    switch (event.data.call) {
      case "setItem":
        localStorage.setItem(
          `localStorage:${docId}:${encodeURIComponent(event.data.key)}`,
          event.data.value
        );
        objStore.put(event.data.value, event.data.key);
        break;
      case "removeItem":
        localStorage.removeItem(
          `localStorage:${docId}:${encodeURIComponent(event.data.key)}`
        );
        objStore.delete(event.data.key);
        break;
      case "initialized":
        res();
    }
  };
  port.postMessage({ call: "init", initialStore });
  console.log("Posted init message");
  window.addEventListener("storage", (event) => {
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
async function clearIdb() {
  const dbs = await window.indexedDB.databases();
  await Promise.all(
    dbs.map((db) => db.name && window.indexedDB.deleteDatabase(db.name))
  );
}
async function getMessagePort(portName) {
  return new Promise((res) => {
    const { signal, abort } = new AbortController();
    self.addEventListener(
      "message",
      (e) => {
        if (e.data == portName) {
          e.ports[0].postMessage(`${portName} inited`);
          res(e.ports[0]);
          e.stopImmediatePropagation();
          abort();
        }
      },
      { signal }
    );
  });
}
async function postMessagePort(portName, window2, port) {
  window2.postMessage(portName, "*", [port]);
  return new Promise((res) => {
    const { signal, abort } = new AbortController();
    port.addEventListener(
      "message",
      (e) => {
        if (e.data == `${portName} inited`) {
          res();
          e.stopImmediatePropagation();
          abort();
        }
      },
      { signal }
    );
  });
}
async function overrideIndexDB() {
  clearIdb();
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
    throw new Error("not all cookies were cleared! Cookie: " + document.cookie);
  }
}
export {
  clearCookies,
  domReplacement,
  domReplacementParentSetup,
  getMessagePort,
  handleProxiedFetchEvent,
  localStorageParentSetup,
  overrideCookie,
  overrideIndexDB,
  overrideLocalStorage,
  postMessagePort,
  proxyFetchEvent,
  sendInitEvent,
  sleep
};
