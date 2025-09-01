declare class FakeDOMStringList implements DOMStringList {
    private _values;
    constructor(...values: string[]);
    contains(value: string): boolean;
    item(i: number): string | null;
    get length(): number;
    [Symbol.iterator](): ArrayIterator<string>;
    [index: number]: string;
    _push(...values: Parameters<typeof Array.prototype.push>): void;
    _sort(...values: Parameters<typeof Array.prototype.sort>): this;
}
export default FakeDOMStringList;
