# Syncing IndexedDB Rows Between Devices

Mainly we know (and record) all operations that happens in an IndexedDB table.
Only need to worry about syncing write operations.

We will use a combination lamport clock/realtime clock for creating a strict
causal ordering which uses the lowest 16 bits of the timestamp to be a value called
`c` which keeps track of causality in the case where the current timestamp
(rounded to the topmost 48 bits) is less than or equal to the last received
or performed event (within 3.90625ms). Furthermore we require events performed
locally to be performed at least 1/16 of a second (aka 3.90625ms) apart.

In the case that the last logged event's timestamp is less than the current
realtime timestamp then c (the lowest 16 bits) will be set to 0 and the upper 48
bits will be sent to the new greatest timestamp. Since the clock is monotonically
increasing, it is safe to assume that the ordering of events is causally
consistent.

This clock system is known as a Hybrid Logical Clock (HLC) [^1].

If there are two events with the same timestamp then a tiebreaker will be done
based on the node id of the writer of the event.

This system does not guarantee eventual delivery. For that we need to stack
eventual broadcast on top of this system. Eventual broadcast is a three-step
algorithm performed on message receipt:

1. If this message has already been delivered (is in our database) then drop the
   received message and halt.
2. add yourself to the set of nodes who have received the event.
3. Concurrently:

   - Save this event to your database.

   - Repeatedly broadcast this event (w/ exp fallback) to all known nodes who
     have not received the event until you receive an ACK back (reliable delivery).
     Update the set of nodes who have received the event with each ACK received.

Since this is a last writer wins (LWW) per-key database, acidity is no longer
guaranteed. However, convergence is guaranteed. The simplest example of a violation
of acidity is a counter which performs the operation set(x, get(x) + 1). If two
nodes perform this operation concurrently, whichever performed the operation
last will "win" and will override the increment performed by the other node.
This is impossible to remedy without significant work in tracking the inputs and
outputs of any given transaction call and running other users' transactions in a
js web worker to mutate the database. This might be worth the investment at a later
date, however for now we will merely strive for eventual consistency, not
serializability. Notably, this system will primarily be used for cross-device
(or cross-tab) syncing rather than multi-user syncing. Furthermore, nothing
prevents layering on CRDTs based on sets of items being layered on top of the
implementation. For instance, to create the counter from above, merely have each
increment add a row with a UUID as its sole field. Then, to get the count, simply
request the length of the rows.

If two nodes sync while both are active, the `beforecontentupdate` and
`contentupdate` custom events will be broadcasted on the document element, with
the `beforecontentupdate` being broadcasted before any changes to indexeddb and
localstorage occur. This allows the tab to store and restore any per-user data
which should not be overloaded. For example, Excalidraw syncs which part of the
document a user is looking at. This is undesired on a cross-device sync and so
the user's location on the document should be stored on the `beforecontentupdate`
event and then be overwritten on the contentupdate event, before triggering the
full sync event.

The `contentupdate` event will contain all the key ranges which have been edited,
both in `localstorage` and in `indexedDB`. This allows custom handling of syncing.
Worst comes to worst the application can simply prompt the user to refresh the
document to get the document up to sync.

However, most local-first (not offline) apps are designed to be able
to at minimum sync data between tabs, and often do so on `focus` and
`visibilitychange` events. These sorts of apps (like excalidraw) which support
cross-tab offline syncing should be easy to add syncing to since it simply
involves broadcasting a `visibilitychange` or a `focus` event on the document in
order to trigger a sync. However, it is important to note that excalidraw
in specific also modifies the location on the document which the user is looking.
As discussed above, one can use the `beforecontentupdate` event to save and restore
data across a `contentupdate` sync. Note that this edit will also be added to the sync
log and eventually be broadcasted to all other nodes, just like all edits done
by the application code. Ideally, in the case of excalidraw, it would be better
to simply not update the in-memory view `excalidraw` has, but unfortunately that
might take more work than it's worth in modifying excalidraw's syncing behavior.

This can be mitigated by setting a minimum amount of edits before cross-device
syncing occurs. In this case, setting that value to 2 should prevent wasteful
back and forth broadcasting, fighting over the position of the view between two
concurrently editing users. Furthermore, debouncing sync broadcast events to only
occur on visibilitychange or after a certain amount of time of inactivity should
further reduce inefficient cross-device communication.

This system assumes that writers are responsible for broadcasting their changes.
Furthermore, this system assumes that users will use backups heavily to restore
overwritten data for applications which poorly use indexedDB by simply going
back in time, copying the old value from the read-only version[^2], and pasting
it into the up to date version of the application[^3].

[^1]: https://cse.buffalo.edu/tech-reports/2014-04.pdf
[^2]:
    Users will be prompted when editing a restored version of a document to
    either fork the document explicitly (into a new document with all version
    history preserved), to revert their write (by returning an abort error to
    the application executing the transaction), or to fast-forward to the up to
    date version of the document.

[^3]:
    Recall that this syncing behavior is meant as a fallback for applications which
    cannot be bothered with implementing custom syncing behavior between users,
    thus "predictable & intuitive conflict resolution" (aka good UX) while nice,
    is not a priority of database syncs over efficiency of transfer and storage.

The various write operations that can be done for a key in between version
upgrades:

- update an existing key with a new value (replacing the old value) (put)
- insert a new key (add)
- delete an existing key (clearing the old value) (clear)
- deleting a set of keys
- deleting an entire key-value store (delete)

All writes within a version of a database can be simplified to be an
update operation of a key being overwritten with a value (so long as there is a
designated "empty" value):

- Obviously updating can be represented as an update.
- Inserting a new key can be represented as an update, either willing the value
  into existence on the update or overwriting a designated "empty" value with
  a new value.
- Deleting an existing key can be represented as an update, where the value is
  overwritten to be a designated "empty" value.
- Deleting a set of keys can be represented as an update for all of those keys,
  where the value is overwritten to be the designated "empty" value.
- Deleting an entire key-value store can be represented as an update for all
  keys, where the value is overwritten to be empty.

Here are the various write operations that are only performed during an
upgrade transaction:

- create a key-value store (ObjectStore)
- delete a key-value store (ObjectStore)
- rename a key-value store (ObjectStore)
- create an Index on an object store (which also sets keyPath, multiEntry,
  and unique)
- delete an index on an object store
- rename an index on an object store

Creates and deletes are equivalent to name changes on the two types,
where there is a specific representation of "empty" for the names and
where the the deleting of a key-value store also sets all fields within
the store to their designated "empty" values at the same time.
