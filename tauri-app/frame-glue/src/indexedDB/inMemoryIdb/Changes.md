# High Level Summary of Changes

I modified [this library](https://github.com/dumbmatter/fakeIndexedDB) to forward along modifications and requests to their in-memory state to another receiving indexedDB instance. This is so that a child frame forwards all of its reads and writes to the parent frame, with a local in-memory cache of the database state to avoid cross-thread messaging when possible.

## TODOs

-   [x] handle index queries
-   [x] handle cursors
