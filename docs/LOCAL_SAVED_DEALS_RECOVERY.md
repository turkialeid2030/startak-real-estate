# Local saved-deal recovery — 21 October 2026

The browser provider now retains a recovery journal before a save, update,
deletion or backup import changes deal/index bytes. On opening the application,
the same origin-scoped Web Lock serializes recovery with cooperating writers.
The prior bytes are restored and verified before normal editing is enabled.
A completed operation has no journal and is retained on reopening.

## Commit and recovery

The journal contains the exact prior/proposed index and changed record strings,
plus hashes of untouched indexed records. Its bounded versioned structure,
checksum, key namespace, unique changes and index delta are checked before
recovery. The checksum detects accidental changes; it is not a signature or
authenticated authority. The journal is temporary, not an append-only audit log.

| Persisted state | Opening behavior |
| --- | --- |
| No journal | Read the current validated index. No rollback is inferred. |
| Journal, before any deal mutation | Verify and clear the unused journal. |
| Journal, partially staged records/index | Restore prior record bytes before republishing the prior index; remove newly staged records last. |
| All proposed bytes, journal still present | Roll back the uncommitted operation. |
| All proposed bytes, journal removed | Retain the completed operation. Journal removal is the commit point. |
| Recovery interrupted | Repeat recovery idempotently from the retained journal. |
| Corrupt/unknown journal, foreign record/index, changed untouched record, failed recovery, or missing coordination | Preserve the journal and block writes. A validated export of currently indexed deals can still be attempted. |

Every successful write and cleanup is checked by reading it back. A final
cleanup error does not start compensation after a possibly completed commit.
A delete-then-reject is decided by readback; ambiguous cleanup reports recovery
required. Observed mutation failures retain the prior compensation behavior,
and clear the journal only after verified restoration of all prior bytes.

Safe local writes require Web Locks; an unavailable API produces a translated
error before deal/index mutation. Reads and export remain available subject to
their structural validators. This prevents an uncoordinated writer from
silently participating in the new recovery protocol. Opening/loading deal data
also shares the operation lock. Corrupt index reads now surface an error rather
than silently looking like an empty portfolio.

Recovery success is disclosed. Recovery-required errors block save, update,
delete and import, including after reopening while the local journal remains
unresolved. Read-only export does not delete the journal or clear that block.
Unindexed staged records are not silently promoted into saved deals.

## Capacity and boundaries

The journal needs additional local storage for prior/proposed bytes. Quota
failure during preparation changes no deal/index bytes; later failures use
verified compensation or retain recovery evidence. A full origin may lack
space even for safely deleting a large record. Preserve a complete external
backup before any manual storage intervention. No automatic eviction, raw
storage clearing or destructive repair is performed.

This protocol applies to the browser local-storage provider, not the asynchronous
host provider or a database. It assumes cooperating current-version documents,
an origin-scoped Web Lock, and persisted individual storage operations. It does
not establish disk synchronization, browser/OS power-loss durability, survival
of eviction/origin clearing, safety of noncooperating older documents, server
transactions, institutional identity/permissions, disaster recovery, or an
authenticated reviewer. Source and financial qualification are unchanged.

Relevant primary specifications:
[Web Storage](https://html.spec.whatwg.org/multipage/webstorage.html),
[Web Locks](https://www.w3.org/TR/web-locks/).
Atomicity of an individual storage call is not a database transaction spanning
several keys or a guarantee of physical disk durability.

## Acceptance

Only synthetic fixtures enter code/CI. Domain tests replay every persisted
mutation prefix of save/update/delete/multi-record import and every recovery
prefix, comparing exact bytes with an independent original/completed snapshot.
Faults before/after each mutation cover preparation and final cleanup. Foreign
state, invalid/recomputed journal structures, corruption, failed cleanup,
missing coordination, idempotence and read-only rescue exports are checked.

Mandatory Chromium/Firefox/WebKit acceptance at desktop/mobile widths reopens
injected persisted prefixes through the actual application and provider. It
checks byte restoration, preservation of committed operations, financial
exports, subsequent saving, persistent write blocks, rescue export, two-document
recovery and unavailable coordination. These are persisted-prefix replays and
real reloads, not actual process kills, physical-device tests or independent
recovery qualification. Exact source, run IDs/counts and artifact digests are
recorded in the PR after final gates and public acceptance pass.
