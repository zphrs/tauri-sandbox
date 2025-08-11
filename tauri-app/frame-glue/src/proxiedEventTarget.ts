type DispatchEventCall = {
    method: "dispatchEvent"
    params: {
        type: string
        eventInitDict: EventInit
    }
}

export function createProxiedEventTarget(port: MessagePort): EventTarget {
    const listeners: Record<
        string,
        Map<EventListenerOrEventListenerObject, AddEventListenerOptions>
    > = {}
    port.addEventListener(
        "message",
        (
            e: MessageEvent<
                { method: string; params: unknown } & DispatchEventCall
            >,
        ) => {
            const data = e.data
            if (data.method === "dispatchEvent") {
                const e = new Event(data.params.type, data.params.eventInitDict)
                // false to prevent an infinite loop between two proxyEventTargets on
                // opposite sides of a MessageChannel
                dispatchEvent(e, false)
            }
        },
    )

    function dispatchEvent(event: Event, postMessage: boolean = true) {
        if (postMessage) {
            port.postMessage({
                method: "dispatchEvent",
                params: {
                    type: event.type,
                    eventInitDict: {
                        bubbles: event.bubbles,
                        cancelable: event.cancelable,
                        composed: event.composed,
                    },
                },
            } satisfies DispatchEventCall)
        }
        for (let [listener, options] of listeners[event.type]) {
            if (typeof listener == "object") {
                listener.handleEvent(event)
            } else {
                listener(event)
            }
            if (options.once === true) {
                listeners[event.type].delete(listener)
            }
        }
        return false
    }

    function addToListeners(
        type: string,
        object: EventListenerOrEventListenerObject,
        options: AddEventListenerOptions,
    ) {
        if (listeners[type] === undefined) {
            listeners[type] = new Map()
        }
        listeners[type].set(object, options)
    }

    function removeFromListeners(
        type: string,
        object: EventListenerOrEventListenerObject,
    ) {
        listeners[type].delete(object)
    }

    return {
        addEventListener: (type, callback, options) => {
            if (callback === null) return
            options = typeof options === "object" ? options : {}
            if (typeof callback == "object") {
                addToListeners(type, callback, options)
            } else {
                addToListeners(type, callback, options)
            }
            if (options.signal) {
                options.signal.addEventListener("abort", () => {
                    removeFromListeners(type, callback)
                })
            }
        },
        removeEventListener(type, callback, _options) {
            if (callback == null) return
            removeFromListeners(type, callback)
        },
        dispatchEvent,
    }
}
