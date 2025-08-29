import { type Notification, notify } from "./rpcOverPorts"

const receivedPorts: Record<string, MessagePort> = {}
const awaitingPort: Record<string, ((port: MessagePort) => void)[]> = {}
type SetupPortNotif = Notification<"setupPort", { name: string }>
async function receivePorts() {
    self.addEventListener("message", (e: MessageEvent<SetupPortNotif>) => {
        if (e.data?.params?.name === undefined) {
            return
        }

        receivedPorts[e.data.params.name] = e.ports[0]
        for (const res of awaitingPort[e.data.params.name]) {
            res(e.ports[0])
        }
        notify(e.ports[0], {
            method: "setupPort",
            params: { name: e.data.params.name },
        } satisfies SetupPortNotif)
    })
}
receivePorts()

export async function getMessagePort(portName: string): Promise<MessagePort> {
    if (receivedPorts[portName]) {
        return receivedPorts[portName]
    }
    return new Promise((res) => {
        if (awaitingPort[portName] === undefined) {
            awaitingPort[portName] = []
        }
        awaitingPort[portName].push(res)
    })
}

export async function postMessagePort(
    portName: string,
    window: Window,
): Promise<MessagePort> {
    const ports = new MessageChannel()
    window.postMessage(
        {
            method: "setupPort",
            params: {
                name: portName,
            },
        } satisfies SetupPortNotif,
        "*",
        [ports.port2],
    )

    return new Promise((res) => {
        const { signal, abort } = new AbortController()
        ports.port1.addEventListener(
            "message",
            (e) => {
                if (e.data == `${portName} inited`) {
                    res(ports.port1)
                    e.stopImmediatePropagation()
                    abort()
                }
            },
            { signal },
        )
    })
}
