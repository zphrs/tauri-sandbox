import { Method } from '../../rpcOverPorts';
import { Handlers } from '../methods-scaffolding/setupIDBMethodHandlers';
export type DeleteDatabaseMethod = Method<"deleteDatabase", {
    name: string;
}, null>;
export declare const deleteDatabaseHandler: Handlers["deleteDatabase"];
export declare function handleDeleteDatabase(port: MessagePort, docId: string): void;
