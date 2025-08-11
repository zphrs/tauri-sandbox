export declare function getMessagePort(portName: string): Promise<MessagePort>
export declare function postMessagePort(
    portName: string,
    window: Window,
    port: MessagePort,
): Promise<void>
export declare function overrideIndexDB(): Promise<void>
