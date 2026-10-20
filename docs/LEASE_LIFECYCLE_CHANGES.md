# Documented local lease lifecycle — 20 October 2026

The operating workspace records early end, future cancellation, a reviewed case-date
transition, and restoration of prior terms as a new revision. Existing terms and
dated-rent-schedule editors retain before/after terms too. These are local records
of supplied documents, not external contract execution or authentication.

## Data and financial behavior

The optional lease changeLog contains at most 100 revisions. Records without history
retain their original shape. Each revision retains complete before/after terms
without nested histories, source/local-review references, reason, recorded/effective
dates and before/after case dates. Snapshots must have the same lease, property,
unit and tenant identity. Import validates revision sequence, chronology,
before/after chain, current terms and lineage kinds. In-memory freezing does not
make this a tamper-proof or authenticated institutional audit log.

An early end must shorten an active lease, remain after its start, and use an
explicit exclusive date. Later schedule rows leave the current terms but remain
in the prior snapshot. A future end keeps ACTIVE as the current declaration;
an end at/before the case date records TERMINATED. Canonical reconstruction
rejects an end conflicting with an entered historical collection period.
Receipts and charges are retained, not rewritten to fit the proposed action.

Future cancellation requires a FUTURE lease not yet started at the case date.
The lease/unit references remain, while the termination declaration excludes it
from forward coverage. Restoration appends a new revision and rechecks dates and
overlaps. It cannot reverse a case-date review, restore across different case
dates or overlap a subsequently entered successor.

Case-date review uses an explicit date on/after the current date, without advancing
from the device clock. ACTIVE/FUTURE declarations become FUTURE, ACTIVE or EXPIRED
by their supplied intervals; EXPIRED/TERMINATED records stay closed. Physical
occupancy, collections, charges, budgets, cash plans and aggregate financial inputs
remain unchanged. Contradictory occupancy or missing/misaligned plans still withhold
affected calculations. Expiry or missing coverage does not prove physical vacancy
or zero income. The existing conservative calculation gates remain mandatory.

Snapshot guards reject stale lifecycle/terms/collection drafts. Editing clears
confirmation; same-tick duplicate submission is blocked. Arabic/English controls
export the local history. Operating-case import/export, saved deals, backup,
financial JSON/source fingerprint and financial HTML retain it. Authentication,
legal-effect and external-action flags remain false. Aggregate engine arithmetic
is unchanged.

## Acceptance and remaining scope

Only synthetic cases enter code/CI. Domain tests independently sum daily rent for
every possible end in a month; cover exact boundaries, source failures, collection
conflicts, overlaps, cancellation/restoration, case-date review, immutable history,
tampered imports, history limits, backups, financial hashes and escaped HTML.
Actual React tests exercise confirmation invalidation, admission, rejected/thrown
callbacks and stale drafts. Mandatory Chromium/Firefox/WebKit acceptance uses
desktop/mobile viewports, actual controls, all four lifecycle actions, financial
reports, saved-deal update, reload, backup and locale changes. A bounded synthetic
mobile screenshot can be emitted for visual review when the local runtime is
unavailable. Full release and published acceptance must pass on the exact source;
actual run IDs, counts, hashes and deployment identity are recorded in the PR.

Remaining: legally effective Ejar/authority execution, notice/renewal/termination
acknowledgments, authenticated handover/occupancy evidence, compliant tax/invoicing,
actual banking/ledger integration, independently verified source completeness,
institutional access and recovery. This closes supported local lifecycle recording
after exact-source acceptance; the full owner audit remains open.
