import { describe, expect, test } from "vitest"
import { requestAsObject, requestFromObject } from "./fetchConversions"
import { handleProxiedFetchEvent, proxyFetchEvent } from "./sw-passthrough-api"
import { FetchEvent as FetchEventPolyfill } from "./fetchEventPolyfill"
describe("fetchConversions", () => {
    test("request send", async () => {
        const original = new Request("https://example.com/test", {
            method: "POST",
            body: "Hello world",
            headers: { "x-planet-origin": "Mars" },
        })
        console.log(original)
        const serded = requestFromObject(
            await requestAsObject(original.clone()),
        )
        expect(Object.fromEntries(serded.headers.entries())).to.deep.equal(
            Object.fromEntries(original.headers.entries()),
        )
        expect(await serded.text()).to.equal(await original.text())
    })
})

describe("sw-passthrough-api", () => {
    test("proxy fetch", async () => {
        const { port1: swPort, port2: mainPort } = new MessageChannel()
        const fe = new FetchEventPolyfill("fetch", {
            request: new Request("https://example.com/test", {
                method: "POST",
                body: "test",
            }),
        })
        handleProxiedFetchEvent(mainPort, async (event) => {
            expect(fe.request.url).to.equal(event.request.url)
            expect(fe.request.method).to.equal(event.request.method)
            expect(await event.request.text()).to.equal("test")
            event.respondWith(
                new Promise((res) => res(new Response("success"))),
            )
        })
        const res = await proxyFetchEvent(swPort, fe as FetchEvent)
        expect(await res.text()).to.equal("success")
    })
})
