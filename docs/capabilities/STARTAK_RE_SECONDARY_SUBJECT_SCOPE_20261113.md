# STARTAK RE — secondary market evidence cannot silently cross properties

2026-11-13 — draft engineering mitigation; owner research only.

## Reproduced source gap
The primary simple-owner capital value and rent had a compare-subject identity HOLD. Yet on the **advanced owner research page**, independent professional adjusted-price state (local to the component), unit-mix / asking cohort values, and fused research scenario/report exports could remain present even after the user changed the subject's property name/location/property right. In addition, evidence binding detection counted only canonical sale/rental comparable rows, not manually entered offers, unit-level rental comparables, unit mix, or nearby-project assumptions.

None of these ancillary research views or manually entered prices is evidence of a verified property transaction.

## Code change and operating contract
1. Extend the owner research-subject binding detector to consider user-entered asking offers, unit-level lease records, entered unit-mix fields, and project source/impact fields. Ignore blank placeholder rows (e.g. an empty nearby project with status PLANNED).
2. Propagate the **same owner comparable-subject mismatch HOLD** already used by the principal market indications to the secondary unit-mix and professional comparable sections, without destroying those input states.
3. Use a property-identity React key for the local professional-comparable adjustments editor. Changing the named property or its right/parcel identity resets old locally edited adjusted prices immediately; they cannot silently be applied to the new property after rebinding. This is deliberately conservative and may require re-entering unsaved manual specialist adjustments.
4. The fused multi-source research panel distinguishes `evidenceScopeHold` from `limitedInterestHold`; either hides property-scenario value and blocks HTML/JSON report export (UI disabled plus handler guard), while the former renders a distinct localized message.
5. Explicitly reattesting source-to-property linkage can remove *only* the source-scope HOLD. It does not verify ownership, authenticate sources, prove rights to use data, or waive professional methodology requirements.

## Tests and unresolved boundaries
Synthetic Playwright end-to-end on Chromium/Firefox/WebKit must verify adjusted-price reset while staying in the advanced view, old-case export denial, blank scenario on changed property, source rebinding controls, and ability to continue on the new case. Exact HEAD `Release Verify` and browser evidence are needed before marking engineering qualified.

Not in scope: true original 17+4 property fixture parity; server authorization; user-specific tenancy isolation; independent ownership, property boundaries or source rights; licensed Saudi appraisal; report-signoff; historic 504-path functionality equivalence; Q01–Q12 signed independent evidence; publication, merge or commercial use. `COMMERCIAL_GO_LIVE=HOLD_NOT_AUTHORIZED`.

6. Retain individually-entered market listing/asking offer input rows, but suppress their qualifying unit-price display and derived asking-price medians while the current property subject is mismatched or has an unsupported limited interest. Restore them only after scope is valid. Asking prices remain distinct from completed transactions.

7. Keep the cross-method replacement-cost/NOI/rent reconciliation editor **mounted and editable** during source-scope HOLD. Mask its computed market, cost, income, rental and method-gap outputs and show an explicit scope notice. Key local methodology input drafts to the property subject so an unrelated case does not inherit adjustments. This also prevents transient evidence-binding HOLD from silently unmounting an opened form and losing edits.
