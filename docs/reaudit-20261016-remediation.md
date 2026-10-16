# Re-audit remediation — 2026-10-16

Source: owner-supplied Arabic re-audit dated 2026-10-15, reviewed against main
`d881e03388882f9939e8b66a585dd58dacbce67a`. Synthetic regression fixtures only;
no private attachments, credentials, actual client records or provider calls
are included in this change.

## Engineering changes and remaining boundaries

| Finding | Implemented scope | Qualification still required |
| --- | --- | --- |
| N01 | Shared strict Arabic/Persian/English numeric parser; decimal/grouping validation; invalid raw text remains visible and blocks current calculations/export. Adopted by main financial inputs, optional percentages, document normalization and operational money inputs. | Browser and release acceptance on the reviewed commit; real document extraction remains evidence-dependent. |
| N02 | Purchase ceiling now inverts the same cumulative operating NOI sequence as payback, including growth, lease-up and fractional years. Price rounds down to halala; binding constraint and excluded investment gates are explicit. | Only yield and operating-payback constraints are solved, not all investment gates. |
| N03 | No fabricated official connection or market evidence. | Licensed/authorized source access, integration, refresh and source-level validation remain OPEN. |
| N04 | No provider activation, secrets changes or paid model call. | Authorized provider setup and end-to-end qualification remain OPEN. |
| N05 | Separate operating and aggregate financial models are not silently overwritten or represented as reconciled. | Unified source-backed reconciliation and report remain OPEN. |
| N06 | Reused case, project/asset or external comparator references fail closed; invalid calendar dates and non-finite error metrics cannot qualify a sample. | Distinct identifiers do not independently prove statistical independence; actual external observations and review remain required. Statistical-confidence and transaction-authority flags remain false. |
| N07 | AI expert-role guard rejects numeric/magnitude prose and requires structured numeric claims to match a cited snapshot fact's key, value and unit exactly. | This is a narrow deterministic guard, not semantic verification of every qualitative assertion or independent market validation. Provider/client output channels and live provider qualification remain OPEN. |
| N08 | Request and provider bodies are read with streamed byte limits and deadlines; the provider deadline includes body consumption, with cancellation on timeout/overflow and explicit read failures. No activation or relaxation of production-disabled AI. | Non-atomic KV rate/token reservations and fail-closed audit persistence remain OPEN. A distributed atomic backend and concurrency qualification are required before enabling provider traffic. Certificate and Turnstile response readers are outside this patch. |
| N09 | Human Arabic labels added for CALCULATED, OCCUPIED and NOT_CALCULABLE; accordion controls expose expanded state and target IDs. | Complete bilingual/accessibility review remains OPEN. |
| N10 | No new unsupported asset qualification claim. | Specialized-asset models, real samples and independent qualification remain OPEN. |
| N11 | Real UI regressions cover numeric entry, invalid-current-input export and purchase-boundary behavior on desktop/mobile; existing asset integrity checks remain mandatory. | Prior production asset-delivery incident is not declared root-cause-resolved merely because a later run passed. |
| N12 | No change to institutional identity/authorization or storage claims. | Cross-device authorization, backup/restore and institutional operation remain OPEN. |

## Reproduction and acceptance

- `node tests/architecture/run_riai_bounded_body.js`: exact byte boundaries, split Arabic UTF-8, invalid encoding, stalled bodies, cancellation that itself stalls, pre-aborted reads and invalid limits. This is local synthetic qualification, not a provider-production test.

- `node tests/architecture/run_reaudit_20261016_numeric_price_sample.js`: 244 assertions across shared parsing, document units, exact minor-unit ledger values, optional percentages, direct-engine/current-report rejection of raw numeric strings, purchase ceilings, repeated samples and overflow-safe aggregate errors.
- `node tests/architecture/run_ai_output_guard_remediation_v2.js`: 12 grouped checks, including the unreferenced market-value reproduction and numeric snapshot mismatches.
- Existing browser owner-study suite extended with real controlled-input and downloaded-report assertions at 1366px and 390px.
- Full release/package/build, CI and deployed asset/browser acceptance must pass for the exact reviewed tree. This document alone is not evidence of deployment.

Audited V2 fixture: the former `126,333,879.07` price reproduces cumulative
payback of about `10.032943` years and fails the ten-year constraint. The
conservatively truncated corrected ceiling is `125,920,419.13`; the fixture
passes its six criteria there, and an additional riyal fails payback. The
report's nearest-halala value is not rounded upward into a boundary violation.

This remains personal analytical research, not a certified appraisal, legal
opinion, autonomous transaction decision, or fully qualified institutional release.
