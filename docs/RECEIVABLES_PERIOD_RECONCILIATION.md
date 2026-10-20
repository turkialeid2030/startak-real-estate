# Statement-period receivables and receipts bridge

`LEDGER_PERIOD_RECONCILIATION_V1` reconstructs balances of the supplied local
rent register over the explicitly declared bank-statement period. It is a
document-register bridge, not recognition of earned contract revenue or a
general ledger, statement-authentication, source-completeness or cash-execution
attestation. It never changes aggregate NOI, NPV, IRR or investment authority.

## Calculation

The canonical ledger graph is validated first. Replaying only events dated
strictly before the period start and exclusive period end reconstructs the two
endpoints. Dates are user-entered event dates in the current snapshot; they do
not prove what was actually known, recorded or approved at a historical time.

Two independent balances must reconcile, both in total and by lease:

- Closing unpaid charges = opening unpaid charges + recorded charges − credits
  − allocations + reversal effects on unpaid charges.
- Closing unallocated receipts = opening unallocated receipts + recorded
  receipts − refunds − allocations + reversal effects on unallocated receipts.

An allocation reduces both balances without new cash. A credit reduces unpaid
charges without cash. A refund reduces unallocated receipts. A reversal applies
the inverse document effect and is displayed separately from receipts/refunds.
Event IDs, related entries, document references, source and local-review
references remain in the result and export. Lease balances remain separate;
no cross-lease offset is inferred.

All sums use BigInt integer halalas. Unsafe conversion, invalid graphs or dates,
out-of-range values, or any nonzero total/lease residual withhold the bridge.
Missing register data is unavailable. Zero endpoints are calculated only from
a supplied, nonempty, valid register; they do not prove completeness.

## Later corrections and chronology

Reversals dated on or after the exclusive end that affect earlier entries are
displayed as later corrections. They do not silently rewrite the earlier-date
bridge. Current statement matching continues to use the active corrected
register, so it can require review even when the historical document bridge
reconciles. Neither output establishes that cash moved.

Reproduced chronology defects allowed a charge/receipt reversal to predate the
last dependent allocation reversal, or a replacement allocation to be backdated
before its correction. Current-state replay could pass while a historical
cutoff overallocated a receipt. Every movement linked to a charge or receipt now
requires a date at least as late as the last movement on that document. Unrelated
documents can retain independent dates. Same-day corrections retain the original
validated dependency order.

## Presentation and evidence

The bank workspace and JSON export share the canonical result. The financial
study embeds current bank matching, entered-balance arithmetic, this period
bridge and sources inside the operating source snapshot/report hash. HTML uses
the same values, at most six columns per table, and escaped user references.
The Arabic/English interface preserves exact two-decimal money and keyboard
access to horizontally scrolling tables. Missing/invalid current data removes
previous balances.

Synthetic tests cover worked journal endpoints, allocations, credits, refunds,
reversals of every supported document type, inclusive/exclusive boundaries,
later corrections, separate leases, overflow, missing/invalid data, chronology,
persistence, report integrity and unchanged aggregate financial results. Actual
React and the three-browser acceptance suite verify screen/export parity.

## Still open

Independent source and asset identity, complete contract/receipt ownership,
bank integration, actual accounting and tax treatment, authenticated reviewer
roles and institutional audit/restore remain unqualified. Period collection
aggregates, contract run-off and forecast cash remain distinct data bases and
are never added to this register. A valid bridge closes this local engineering
gap only; it does not close N05 or the whole owner audit.
