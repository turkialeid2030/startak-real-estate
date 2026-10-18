# Re-audit remediation — 2026-10-16

Source: owner-supplied Arabic re-audit dated 2026-10-15, reviewed against main
`d881e03388882f9939e8b66a585dd58dacbce67a`. Synthetic regression fixtures only;
no private attachments, credentials, actual client records or provider calls
are included in this change.

## Engineering changes and remaining boundaries

| Finding | Implemented scope | Qualification still required |
| --- | --- | --- |
| N01 | Shared strict Arabic/Persian/English numeric parser; decimal/grouping validation; invalid raw text remains visible and blocks current calculations/export. Adopted by main financial inputs, optional percentages, document normalization and operational money inputs. | Browser and release acceptance on the reviewed commit; real document extraction remains evidence-dependent. |
| N02 | Purchase ceiling inverts cumulative operating NOI. UI/report re-evaluate that candidate through the full engine and expose a qualified price only when all six (or eight financed) criteria pass. The report additionally searches a lower passing price and refines a sampled pass/fail interval to halala resolution, retaining the complete criterion evidence. | The lower alternative is verified at its price, but global maximality is not established for arbitrary nonmonotonic inputs. Incomplete criteria and unsuccessful sampling never establish feasibility or infeasibility. Full general constrained-price optimization remains OPEN. |
| N03 | No fabricated official connection or market evidence. | Licensed/authorized source access, integration, refresh and source-level validation remain OPEN. |
| N04 | No provider activation, secrets changes or paid model call. | Authorized provider setup and end-to-end qualification remain OPEN. |
| N05 | PR687 attaches the validated current operating snapshot, calculated runoff and source fingerprint to the financial report. PR688 adds dated collections, monthly accrual/CAPEX and cash-plan tables, conservative liquidity and component issues. | Associated asset identity is not independently verified; aggregate-engine inputs/returns are not reconciled to operating records. Full source-backed reconciliation remains OPEN. |
| N06 | Reused case, project/asset or external comparator references fail closed; invalid calendar dates and non-finite error metrics cannot qualify a sample. | Distinct identifiers do not independently prove statistical independence; actual external observations and review remain required. Statistical-confidence and transaction-authority flags remain false. |
| N07 | Expert-role guard requires exact cited snapshot facts for structured numeric claims. Provider gateway now rejects numeric/magnitude prose across returned fields, including Arabic/Persian/Latin digits, and rejects its unsupported financialClaims channel. Provider instructions require qualitative output only; deterministic financial values remain in the financial report. | This is a lexical fail-closed guard, not semantic verification of every assertion or every number-word in all languages. Structured numeric provider output and independently verified market conclusions are not enabled. Live qualification remains OPEN. |
| N08 | Bounded request/provider, Access certificate and Turnstile bodies and audit writes; mandatory start/terminal audit events; unique event keys. Atomic shared-actor admission integrated; legacy KV admission disabled; consistent provider usage settles idempotently. No activation of production AI. | Real namespace deployment, persistence/concurrency qualification, model-specific token bound and monetary-cost controls remain OPEN. KV acknowledgment does not prove immutable institutional logging; timed-out writes may complete later. |
| N09 | Human Arabic labels added for CALCULATED, OCCUPIED and NOT_CALCULABLE; accordion controls expose expanded state and target IDs. | Complete bilingual/accessibility review remains OPEN. |
| N10 | No new unsupported asset qualification claim. | Specialized-asset models, real samples and independent qualification remain OPEN. |
| N11 | Real UI regressions cover numeric entry, invalid-current-input export and purchase-boundary behavior on desktop/mobile; existing asset integrity checks remain mandatory. | Prior production asset-delivery incident is not declared root-cause-resolved merely because a later run passed. |
| N12 | No change to institutional identity/authorization or storage claims. | Cross-device authorization, backup/restore and institutional operation remain OPEN. |

## Reproduction and acceptance

- 2026-10-18: PR688 head `1a0ae78f427d25feb59c65a3e479a0fc9ea26ca7` passed all six applicable remote workflows and was merged as `519fe78be69b4820b3d930af81bff5e6bba4aee8`. Deployment is separately verified; merge alone is not publication evidence.
- Purchase-boundary qualification regression checks a passing candidate, a one-riyal breach, high-discount-rate abstention, financed criteria, invalid prices and report output. It does not claim a general price optimizer or independent market evidence.
- Previously published PR687 merge `51ff8f3a1533d6384eaed87344865ad8bbe13d1e` passed deployed byte verification for ten assets. This does not close the historical transient 404 root cause.

- Audit regressions: 20 concurrent writes with an identical timestamp/snapshot retain 20 events; missing/throwing stores block provider calls; failed terminal persistence withholds output after a mocked provider call; stalled writes return an explicit timeout. These do not qualify distributed rate/token atomicity.

## Current implementation sequence and evidence boundaries

- N08 atomic quota worker: `workers/riai-quota/` combines rate and token reservation in a storage transaction, rejects duplicate-ID conflicts, settles usage idempotently, retains uncertain usage and blocks overages. Gateway now uses one fixed shared actor; missing/failed bindings and replayed reservations reject provider access. Legacy KV admission exports reject. Ten concurrent synthetic gateway requests under limit one produced one provider call; consistent usage settled once. **Deployment and real runtime qualification remain open.** Production binding, model-specific full-request token bound, persistence/restart qualification and monetary-cost controls remain required. See worker README for activation gates.

- Published batch `53266c20ef918d30564f8d1f850daa7e6e6ded17`: numeric parsing (N01), cumulative building ceiling within its disclosed constraints (N02), duplicate sample rejection (N06), expert-role output guard (partial N07), selected Arabic/accessibility labels (partial N09). Published acceptance passed on rerun; the earlier asset 404 is retained as unresolved N11 evidence.
- PR #682 / merge `3d9abc1b877157b736ff02e1372674b7724e7ae7`: bounded gateway bodies; all four applicable PR workflows passed at reviewed head `9770a7d1205a67d93b8c86536062af8d4efa16d5`. Merge is not independent evidence of production deployment.
- Next technical dependencies: deployed atomic namespace and runtime qualification (N08); source-linked operational/financial reconciliation without cash/accrual or CAPEX/reserve double counting (N05); provider-channel financial assertion controls (N07).
- External qualification remains separate: authorized market-data access and live requests (N03), configured/qualified provider (N04), independent real-asset sample and specialized models (N06/N10), authenticated institutional roles and restore evidence (N12), assistive-technology and delivery-root-cause evidence (N09/N11). No blanket closing of F01–F24 follows from these changes.

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
