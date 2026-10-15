# Additional dated cash flows — 15 October 2026

The owner scenario can now include separately sourced financing, tax, deposit,
fee and other inflows or outflows. Each positive SAR amount has an explicit
direction, valid date within the case horizon, description, source and reference.
References are unique across rent receipts and these additional movements.
The user must review that movements do not duplicate OPEX or CAPEX plans.

Monthly balances include additional inflows and outflows in separate columns.
The daily check includes the same movements and retains the conservative
payments-before-receipts order for a shared date. Funding received later cannot
hide an earlier gap. Deposit cash does not enter rental revenue or NOI.

Each additional category has a separate declaration: `NOT_REVIEWED`, `ENTERED`
or `NONE_EXPECTED`. An empty category is not silently reviewed or certified zero.
Declarations that contradict entered rows are rejected. Editing or removing a
row resets its category review and the form confirmation. Saved declarations
and movements survive snapshot replay and unrelated ledger or lease updates.
Cash drafts bind to the current operating and capital plans; changed plans
require reloading an existing draft before another review is recorded.

Legacy snapshots remain supported with all additional categories unreviewed.
The calculation stays `PARTIAL_SCENARIO`, `coverageComplete=false`, and
`actualBankBalance=false`, even when all category reviews are declared. This
does not authenticate sources, establish complete inventory or bank funds,
calculate taxes or interest, verify financing availability, create ledger
entries, connect to institutions, or authorize professional release.

Verification includes exact-cent monthly and daily balances, both directions
for every category, explicit zero assumptions versus missing reviews,
cross-kind duplicate references, source/date/classification validation,
contradictory declarations, legacy compatibility, snapshot replay, unchanged
analytical rental results, and safe failure on aggregate/intermediate overflow.
Browser acceptance covers Arabic desktop/mobile workflows in Chromium,
Firefox and WebKit, including rejected duplicates, review invalidation,
category conflicts and restored calculations. Deployment acceptance also
checks source binding and all final asset bytes before browser checks.
