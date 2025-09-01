import { Method } from '../../rpcOverPorts';
import { Handlers } from '../methods-scaffolding/setupIDBMethodHandlers';
export type CloseDatabaseMethod = Method<"closeDatabase", {
    name: string;
}, null>;
export declare const closeDatabaseHandler: Handlers["closeDatabase"];
export default function handleCloseDatabase(port: MessagePort, docId: string): void;
