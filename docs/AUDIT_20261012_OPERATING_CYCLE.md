# Documented operating cycle: receivables, planned CAPEX, successor leases

This delivery adds three concrete operating workflows to the existing case workspace. It does not close the full institutional or commercial audit.

## Rent document register

The optional `receivablesLedger` records CHARGE, RECEIPT, ALLOCATION and REVERSAL events. Amounts are positive safe integer halalas. The UI accepts SAR with at most two decimals and requires source and distinct local-review references, with confirmation invalidated after edits. Empty/missing amounts cannot become zero. No events means unavailable totals, not confirmed zero business activity.

Charges belong to an existing lease and cover an exclusive-end rent period inside that lease. Active charge periods cannot overlap for the same lease. The register supports net rent only, not taxes, deposits, fees, split invoices over the same rent period, tax invoice generation or bank integration. Each entry ID and each document/transaction reference within its type are unique, including after reversal. Receipts can remain unallocated. An allocation must reference an earlier active charge and receipt for the same lease, may not exceed either balance, and may not predate them. A charge or receipt with active allocations cannot be reversed until its allocations are reversed. Original events remain in the export. Reversal is correction of an entry, not a refund or write-off.

The summary reports gross recorded charges, actual entered receipts, allocations, unpaid charges, unapplied receipts, receipt months and due-date aging. Not due, due today and overdue balances are distinct. There is no implicit cross-lease offset. Coverage is only the entered documents; no independent proof of completeness or bank authenticity is claimed. Legacy period collections are preserved separately and are never added to the ledger or automatically rewritten into NOI. A 5000-event limit bounds replay; totals fail on unsafe integer overflow. Import replays validation; existing lease/schedule edits preserve the ledger. Stale drafts and repeated in-flight submissions are blocked.

## Explicit capital payment dates

The optional `capitalPaymentPlan` distributes the estimated cost of every supplied CAPEX item across explicit dates. Source/review references and confirmation are required. Plans reconcile in integer halalas to each adopted, sourced cost; missing cost, incorrect currency, unadopted cost, mismatched totals or past planned dates withhold net after CAPEX. No maintenance deadline is silently used as a payment date. Payments outside the twelve-month horizon are disclosed separately. An empty reviewed plan declares zero for the supplied inventory only; it does not prove that no works are missing. Plans can use up to 2000 item/date entries. Cost changes invalidate the projection until the plan reconciles again.

The run-off retains net before CAPEX and separately presents scheduled CAPEX and analytical net after it. Rent is still accrual and OPEX is still normalized allocation; this is not a cash balance or collection forecast. No spending authorization, main-engine mutation, tax, financing or completion of the physical works is implied. Existing item inventory is imported with the operating case; this editor schedules those items rather than performing a technical survey or creating qualified item estimates.

## Documented successor leases

A successor lease can be recorded against an existing unit, with a new unique lease ID, an existing tenant, future dates, explicit periodic rent and source/adoption references. It cannot precede the prior lease expiry or overlap another active/future lease for the unit. The old lease stays intact. The new lease starts with fixed rent in the prior frequency; security and escalation are not copied. A dated rent schedule can be added explicitly afterward. Current occupancy metrics are unchanged, and any gap remains without contractual income. This is a document-entry workflow, not assumed renewal, predicted market rent, regulatory permission, tenant authentication or automatic lifecycle rollover.

## Verification and boundaries

Focused tests cover integer conservation, partial/excess receipts, over-allocation, invalid dates, duplicate references, cross-case/lease protection, correction ordering, aging boundaries, schedule/cost reconciliation, month boundaries, successor gaps, non-mutation and save/import/export. Real-browser acceptance exercises the complete workflows on Chromium, Firefox and WebKit at desktop/mobile widths, including confirmation invalidation, rejected operations, successful correction, round trips and case isolation. Exact commit CI and deployed acceptance are recorded in the PR and #658 after they actually pass.

Still open: compliant invoice issuance and integrations, refunds/credit notes/tax/deposits, authenticated institutional ledger and reconciled bank evidence, operating-cost/payment forecasts, automatic lifecycle transitions and scenario-based reletting, specialized asset/tenure valuation, qualified OCR, institutional identity/storage/security/restore, professional/legal release and market/commercial qualification. No private user documents are included in this delivery or CI fixtures.
