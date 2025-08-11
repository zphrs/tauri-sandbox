# IndexedDB Implementation Notes

## Start with Version Change

- need to batch version change requests: e.g. createIndex, createObjectStore, etc.
- need to know whether a version change event will be triggered when opening the DB
    - can figure this out by listing all DBs and their versions at initialization of the web application
    - then can check the version passed into the IDBFactory and determine from that whether a versionchange event will occur.
    - if a versionchange event will occur then _don't message up_ the open event yet.
    - Instead broadcast the versionchange event to the listeners on the IDBOpenDBRequest and then batch all of the IDB api calls used into an array.
    - Then pass that array to the main thread once the event listener resolves so that the the main thread can construct the DB.

Can only call createObjectStore, deleteObjectStore, createIndex, deleteIndex,

## Then handle Transactions
