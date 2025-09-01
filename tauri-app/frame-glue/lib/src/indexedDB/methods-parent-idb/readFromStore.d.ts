import { Handlers } from '../methods-scaffolding/setupIDBMethodHandlers';
export declare function requestToPromise<T>(request: IDBRequest<T>): Promise<T>;
export declare const executeReadHandler: Handlers["executeRead"];
export declare function handleReadMethod(port: MessagePort, docId: string): void;
