import { Method, Notification } from '../../../rpcOverPorts';
import { KeyPath } from '../../inMemoryIdb/lib/types';
import { Write } from './transaction';
export type ObjectStoreUpgradeActions = Notification<"createIndex", {
    name: string;
    keyPath: string | string[];
    options?: IDBIndexParameters;
}> | Notification<"renameObjectStore", {
    newName: string;
}> | Notification<"deleteIndex", {
    name: string;
}> | Notification<"modifyIndex", {
    name: string;
    newName: string;
}>;
export type UpgradeActions = Notification<"createObjectStore", {
    name: string;
    options: IDBObjectStoreParameters;
    doOnUpgrade: (ObjectStoreUpgradeActions | Write)[];
}> | Notification<"deleteObjectStore", {
    name: string;
}> | Notification<"modifyObjectStore", {
    name: string;
    doOnUpgrade: (ObjectStoreUpgradeActions | Write)[];
}>;
export type OpenDatabaseMethod = Method<"openDatabase", {
    name: string;
    version?: number;
    doOnUpgrade: UpgradeActions[];
}, {
    objectStores: {
        name: string;
        parameters: IDBObjectStoreParameters;
        indexes: {
            name: string;
            parameters: IDBIndexParameters;
            keyPath: KeyPath;
        }[];
    }[];
}>;
