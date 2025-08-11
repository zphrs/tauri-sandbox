import { describe, expect, test } from "vitest"
import { call, handleRequests, type Method } from "./rpcOverPorts"

type PingMethod<T = unknown> = Method<"ping", T, T>
type ToNumberMethod = Method<"toNumber", `${number}`, number>
type TransferArrayBufferMethod = Method<
    "transferArrayBuffer",
    { buf: ArrayBuffer },
    { buf: ArrayBuffer }
>
describe("rpc over ports", () => {
    const { port1, port2 } = new MessageChannel()

    handleRequests<PingMethod<string>>(port1, "ping", async (req) => {
        await new Promise((res) => setTimeout(res, Math.random() * 100))
        return req
    })

    handleRequests<ToNumberMethod>(port1, "toNumber", async (req) => {
        return Number.parseFloat(req)
    })
    handleRequests<TransferArrayBufferMethod>(
        port1,
        "transferArrayBuffer",
        async (req) => {
            return { result: { buf: req.buf }, transferableObjects: [req.buf] }
        },
    )

    test.concurrent.for([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10])(
        "Ping %i",
        async (n) => {
            const res = await call<PingMethod<number>>(port2, "ping", n)
            expect(res).toBe(n)
        },
    )
    test.concurrent.for([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10])(
        "To number %i",
        async (n) => {
            const res = await call<ToNumberMethod>(port2, "toNumber", `${n}`)
            expect(res).toBe(n)
        },
    )
    test("transfer array", async () => {
        const buf = new ArrayBuffer(10 * 4)
        const view = new Int32Array(buf)
        for (let i = 0; i < 10; i++) {
            view[i] = i
        }
        ArrayBuffer
        const res = await call<TransferArrayBufferMethod>(
            port2,
            "transferArrayBuffer",
            { params: { buf }, transferableObjects: [buf] },
        )
        const returnedBufView = new Int32Array(res.buf)
        for (let i = 0; i < 10; i++) {
            expect(returnedBufView[i]).toBe(i)
        }
    })
})
