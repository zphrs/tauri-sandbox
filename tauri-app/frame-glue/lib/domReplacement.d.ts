export declare function domReplacement(): void
export declare function sleep(s: number): Promise<void>
export declare function domReplacementParentSetup(
    iframe: HTMLIFrameElement,
): Promise<(newDom: string) => void>
