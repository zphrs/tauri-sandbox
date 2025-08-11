export function createEventTarget(): EventTarget {
    return new EventTarget()
}

export function extendObjectWithEvents<T, EventTypes extends readonly string[]>(
    into: T,
    eventTypes: EventTypes,
) {
    type EventType = EventTypes[number]
    type ExtendedObject = {
        [Name in EventType as `on${Name}`]: EventListener | null
    } & T &
        EventTarget & { prototype: unknown }

    if (!(into instanceof EventTarget)) {
        Object.setPrototypeOf(into, EventTarget)
    }
    const out = into as ExtendedObject

    for (const eventType of eventTypes) {
        out.addEventListener(eventType, {
            get handleEvent() {
                const handler = out[`on${eventType}` as keyof ExtendedObject]
                return typeof handler === "function"
                    ? (handler as EventListener)
                    : ((() => {}) as EventListener)
            },
        })
    }

    return out
}
