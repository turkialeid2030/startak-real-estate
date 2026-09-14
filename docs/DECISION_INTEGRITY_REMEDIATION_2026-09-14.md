# STARTAK Real Estate — Decision Integrity Remediation

Date: 2026-09-14
Base candidate: `21f51ad5b4c6787c556aa3b8528d9c3ec17f12c3`

## Scope

This remediation addresses defects discovered during expert user-style and financial-model review of the immutable Cloudflare preview for the qualified candidate. It does not merge, deploy production, authorize a transaction, activate a canonical baseline, or declare Go-Live.

## Corrected controls

- Reject negative construction cost, land geometry, market/rent inputs, and other economically invalid negative values at the canonical engine boundary.
- Preserve legitimate fractional year periods supported by monthly financing calculations.
- Enforce integer-only structural counts where fractional physical counts are invalid.
- Preserve the aggregate zero-project-cost fail-closed guard.
- Prevent ordinary number/percent input editing from silently coercing a temporarily blank field to zero.
- Align Existing Building displayed decision criteria with engine criteria: stabilized NOI, net yield on total acquisition cost, cumulative payback on total acquisition cost, IRR, NPV, income value versus cost, and when financed DSCR plus levered NPV.
- Align Land Development displayed decision criteria with engine criteria: stabilized NOI, cumulative project payback, NPV, IRR, completion value versus project cost, and when financed DSCR plus levered NPV.
- Separate first-year lease-up income/NOI from stabilized Existing Building income/NOI.
- Expose the material governed V2 OPEX assumptions used in Land calculations and display the OPEX decomposition used by the engine.
- Disclose that Murabaha/Ijarah financing calculations are indicative rate-based monthly proxy models rather than executed contractual models.
- Render incomplete-input state as a hold/pending analytical state rather than a negative/no-buy state.
- Reframe the customer-facing section as a financial analytical result and explicitly separate regulatory/legal/professional verification from the financial score.

## Mathematical verification

A dedicated regression (`tests/defects/decision_integrity_wave.js`) verifies key financial identities, criterion-code parity, invalid-input fail-closed behavior, and UI/engine semantic bindings.

The remediation runner before cleanup produced:

- `DECISION_INTEGRITY_WAVE=PASS`
- `REGRESSION_TOTAL=414 PASSED=414`
- `TEST_DISCOVERY_AND_REGRESSION=PASS`
- `PRODUCTION_BUILD=PASS`
- `VERIFY_PACKAGE=PASS`
- npm audit: `0 critical / 0 high / 0 moderate / 0 low`
- `RELEASE_VERIFY_RESULT=PASS`

The final clean branch must still pass ordinary pull-request CI at its exact head before it can be considered technically qualified.

## Governance boundary

This branch is a successor remediation candidate. The previously frozen Phase A tuple for source SHA `21f51ad5...` is not silently reused for this changed code. Any future release of this remediation requires a new exact source/artifact/environment evidence tuple and the existing governed review/merge/deployment chain.
