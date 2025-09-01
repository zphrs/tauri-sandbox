export type SerializedQuery = IDBValidKey | {
    lower: any;
    upper: any;
    lowerOpen?: boolean;
    upperOpen?: boolean;
};
export declare function deserializeQuery(range: SerializedQuery): IDBValidKey | IDBKeyRange | undefined;
export declare function serializeQuery<T extends IDBValidKey | IDBKeyRange | undefined>(range: T): T extends undefined ? SerializedQuery | undefined : SerializedQuery;
