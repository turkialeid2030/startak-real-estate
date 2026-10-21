# Saved-deal storage, backup and restore safety — 20 October 2026

Update 21 October: the browser provider now has a persistent recovery journal,
startup recovery and a durable write block while its journal cannot be resolved.
See [local recovery](LOCAL_SAVED_DEALS_RECOVERY.md) for its commit point, quota
requirements and tested interruption model. Host storage retains compensation
and a session block; it does not acquire browser crash-recovery qualification.

This change repairs two reproduced defects: repeated incoming IDs could create
duplicate index rows and overwrite one another; a failed restore write could
leave staged records after an error that claimed current data was unchanged.
Ordinary save/update/delete also exposed partial record/index changes after an
observed storage failure. They now use the same verified compensation path.

## Supported behavior

Backups retain format `STARTAK_SAVED_DEALS_BACKUP`, version 4. Versions 1–3 remain
readable. Export and restore use the canonical saved-deal structural validator;
they do not reclassify sources, adopt assumptions or qualify financial results.
Assumption registries and their version are preserved alongside existing
operating cases, valuation configuration/drafts, Zakat, rental context, input
provenance and standards metadata. Export previously omitted the registry.

Files are bounded to 10 MiB of UTF-8, 200 deals in the final index, 32 JSON nesting
levels and 350,000 visited values. The file size is checked before reading; the
actual decoded size is checked again before parsing. Prototype-pollution keys,
non-finite values, duplicate/empty/control-character IDs and conflicting storage
identities are rejected before restore writes. Export fails as a whole when a
record is corrupt, mismatched to its indexed ID or outside the limits.

An identical existing ID/record is skipped. A different record with the same ID
is copied to an unused deterministic `~restored-N` ID, reserving incoming IDs as
well. Original records and source/case references remain intact; changing the
container ID does not establish a new independent case. The UI reports added,
skipped and conflict-copy counts. Restoring the same conflicting source again
may create another copy; it does not overwrite an earlier copy.

Plans are immutable, detached from file objects, single-use and tied to their
observed index/record state. Restore rechecks state and target keys, stages only
new records, verifies each write and publishes the final index last. On a write
failure it attempts compensation and verifies the old index and removal of its
staged records. A write-then-reject acknowledgment is covered. A foreign index
or changed staged record is never overwritten during compensation.

New UI saves allocate an unused ID inside the lock. Updates preserve imported
assumption registries and read-only standards metadata; explicitly cleared
editable Zakat/operating/valuation cases remain cleared. Updates stage and
verify the changed record before publishing its index metadata. Deletions
unlink the index before removing the record. Compensation restores any prior
record bytes before republishing the prior index, then removes newly staged
records. The outcome must be verified byte for byte; foreign record/index
changes are not overwritten.

Verified compensation has a separate failure message. Unverified compensation
produces `RESTORE_RECOVERY_REQUIRED`; saving, deleting and importing are blocked
in that running application session, while a validated current export can still
be attempted. The UI does not promise unchanged data in that state. Users must
retain the original backup and review the data before further recovery.

All cooperating save/update/delete/export/restore paths share an origin-scoped
Web Lock. Safe browser writes now require that API; other providers retain the
per-runtime fallback queue. Import reads a fresh
storage snapshot inside that lock, and export reads the current index instead
of an older React list. Same-tick duplicate import is stopped before reading the
file; controls and the accessible busy status reflect ongoing operations.
Native file selection has a keyboard-accessible button.
Starting any storage operation clears the preceding operation's result, so a
stale success cannot appear alongside a newer save/import/recovery failure.
The session recovery warning persists after a successful read-only export;
that export contains only currently indexed valid records and does not clear
the write block or establish that unindexed staged data has been recovered.

## Scope and remaining limits

This is a saved-deal transfer, not a full application backup. Original documents,
document/action review journals, unsaved form state and credentials are excluded
and disclosed in the UI. It does not create authenticated reviewer identity or
change source verification, transaction authorization or financial arithmetic.

The browser recovery protocol covers persisted prefixes of an interrupted
multi-key operation, with a verified rollback on reopening. It is not a database
transaction or physical-disk durability proof. Actual process/device failure,
late/ambiguous writes by a remote host, noncooperating/older tabs, quota failure
during recovery, eviction and external deletion remain limits. Neither the
temporary browser journal nor the host session block is a cross-device incident
record or an authenticated audit log.
Institutional persistence, authenticated access, encryption/retention policies,
real-device recovery, disaster recovery and independent qualification remain open.

## Verification

Synthetic tests exercise duplicate/reserved IDs, version compatibility, registry
and operating-source preservation, plan immutability, stale snapshots, occupied
unindexed keys, bounded/malicious JSON, concurrent imports and every failing
write position before/after acknowledgment. Rollback failure/foreign-index
cases explicitly require recovery. Tests compare restored financial arithmetic.
Save, update and delete have fault injection at every record/index operation,
including delete-then-reject, exact byte restoration, ignored writes and failed
compensation. Update tests preserve registries while clearing editable cases.

Mandatory browser acceptance transfers an actual UI export from Chromium into
fresh Chromium/Firefox/WebKit contexts at desktop/mobile widths, reloads data,
compares source inputs/operating fingerprints and independently hashed financial
reports, and exercises same-tick duplicate admission, a stalled asynchronous host,
two-tab concurrency, oversize/duplicate/corrupt files and real provider failures.
The real UI save/update/delete paths also face write/delete-then-reject failures
in all three browsers, followed by a successful update preserving provenance;
an asynchronous host failure verifies the session write block for a failed save.
Only synthetic data enters CI artifacts. These are browser viewports, not physical
device or institutional recovery certification. The three historical hardcoded
PR12 browser observations now report `NOT_RERUN`; current browser evidence is
produced by executable acceptance instead.
