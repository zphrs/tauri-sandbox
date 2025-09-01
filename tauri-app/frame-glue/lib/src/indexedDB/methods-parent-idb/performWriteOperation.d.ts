import { Write } from '../methods-scaffolding/types/';
export declare function performWriteOperation(change: Write, store: IDBObjectStore): Promise<IDBRequest<IDBValidKey> | IDBRequest<undefined>>;
