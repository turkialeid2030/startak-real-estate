# STARTAK Real Estate — historical feature/function disposition (14 November 2026)

**Repository:** `turkialeid2030/startak-real-estate`. **Comparison candidate:** #800 exact `ae0599b557738c677bf5fcc6cb1f23b6c18da522`, itself a stacked **DRAFT**. **Main:** `b8ab7d3156a751ca57dec93ba9d9a7ad230b1566`. **Commercial decision:** `HOLD_NOT_AUTHORIZED`.

## Audit method and limits
- Fetched **648 branch names** from GitHub in seven pages at the previous census checkpoint; 638 distinct tip SHAs. This is a **name/tip census**, not a source or functional audit of all 638 commits.
- This expanded examination retrieves source trees from **10 representatives**: C75 personal `8bc8ecf`, W12 DCF `7d309cb`, W14 specialist `c5907bd`, W16 decision `eb1fa24`, W17 closeout `1770fbe`, RIAI AI `5dec02e`, RIAI strategy `4145fdc`, universal model `03d9d08`, productization baseline `292363d`, productization release `ec47957`. Source head is the #800 SHA above.
- Recorded the **immutable Git blob ID** of each exact historic file absent from the modern candidate and which sampled family contains it.
- **57 distinct old source paths absent at identical paths** across sampled trees: **53 from C75** and **4 new candidates** (3 from W17, 1 from RIAI strategy). This is neither an exhaustive all-branch functional comparison nor 57 proven missing capabilities.
- 20 historic source APIs were directly opened and inspected: C8 title/survey, C9 planning, C10 market interpretation, C11 income, C12 costs, C13 settlement, C14 financing offers, C15 rental rules, C16 auction, C18 subdivision, C19 policy shock, C2N source acquisition, C3 reconciliation, C5 decision UI, C6 human review UI, C73 Postgres custody, Wave17 release/security/performance and RIAI strategic intelligence. **37 remaining paths are verified only at Git tree/path level**.
- For 56 rows, a current **existing path** has been associated as a *candidate research anchor*, **not a replacement, equivalent API, mounted UI, security implementation, valid current model or accepted case**. The former crypto shim is not proposed for reinstatement.
- No private deed, report, tenant identity, source material, approved valuer information or golden expected property value is committed in this audit.

## Inventory counts (disjoint path-level triage states)
| State | Count | Interpretation |
| --- | ---: | --- |
| Current code anchor exists, functional equivalence NOT proven | **46** | Requires API mapping, user flow, behavior, report and independent-sample tests |
| Historic C73 staging/custody contract | **10** | Historical code expressly does not establish a production vault; do **not** copy into browser or declare cloud custody |
| Old browser crypto shim, safe-retirement review | **1** | Do not restore unsafe ambient shim to make an old module run |
| **Total** | **57** | Non-identical source paths; may be fewer or more distinct features |
| API-inspected historical files | **20** | Source-level comparison started; not yet functionality-certified |
| Tree-only historical files | **37** | Detailed source/behavior inspection remains due |

**Suggested triage, not engineering-completion statistics:** P0 = 23 path entries; P1 = 28; P2 = 6. Some paths refer to the same functional contract; do not use this as a count of 57 issues, nor add the 14 G-gates and 36 Q-evidence as though disjoint.

## Confirmed contract differences requiring functional reconciliation
1. **C8 title/survey** `src/property/governed-title-survey-verification.js`: historic function `verifyGovernedTitleSurveyPropertyEvidence` cross-checks professional source evidence and reconciles evidence facts. Modern `src/title-intelligence/index.js` exposes `assessTitleFacts` and property fact completeness/legal-review flags, **not a proven equivalent multi-document independent source reconciliation**. P0. Accept only with canonical parcel/deed rights and real cross-document difference test, not equal strings.
2. **C9 planning envelope** `src/planning/governed-plot-feasibility.js`: historic `evaluateGovernedPlotFeasibility` consumes professionally reviewed urban-code profiles and surveyed rectangular geometry. Modern `src/planning/index.js` reexports planning **evidence**, not the historic evaluated buildable envelope. P1. Need independent zoning/source/date/geometry and exact UI/report behavior.
3. **C14 finance** historic `evaluateGovernedFinancingOptions` compares documented alternative offers, schedules, covenants and financing policy. Modern investment finance ratios are an analytical anchor, not evidence of governed option comparisons. P1. Require dated debt-service and financing-offer tests and double-count prevention.
4. **C11 tenant/income** historic `evaluateGovernedIncomeAssetIntelligence` includes verifiable tenant strength, rent-roll expiry concentration and evidence binding. Modern `lease-income-evidence.js` is an income evidence path but not proven C11 parity. Require landlord/tenant isolation, lease roll, actual collections and rights checks.
5. **C15 rental regulatory** historic explicit effective-rule, applicability and rental-action guard is not certified by merely finding Saudi regulation source catalog. Fail closed until current legal applicability, geography/date/rights and signed lawyer review; no automatic rent-rule opinions.
6. **C18 split/merge**, **C19 policy shocks**, **C16 auctions**, **C13 security/settlement** represent distinct historical specialist analysis contracts. No safe assertion that new general property, financing, comparables or decision screens replace them; independent negative and eligibility tests are required.
7. **C3 reconciliation** `evaluateValuationReconciliation` historically consumed formally governed context/rights evidence and instruction from a professional. New `value-reconciliation-audit.js` performs non-certified arithmetic checks and expressly produces no automatic primary valuation. No complete professional parity established.
8. **C5/C6 decision and review UI**: historic `GovernedDecisionOperationsPanel.jsx` and `GovernedHumanReviewPanel.jsx` are absent by original path. `IntegratedCaseReviewPanel.jsx` and guided decision facilities exist but were not found as direct imports in the inspected `src/app/App.jsx` or `src/main.jsx`; review authentic app navigability, actual server identity, approval/audit and export in a browser rather than importing a professional panel that could mislead.
9. **C73 custody**: ten old source paths including `c73-postgres-custody-service.js`, `c73-witness-service-auth.js` and `c73-signed-document-custody.js`. Old `createPostgresCustodyService` explicitly said `productionVaultReady:false`. Modern `src/market/private-appraisal-evidence-vault.js` explicitly identifies itself as **server-side storage contract, NOT deployed service**. This is an operational security gap, **not justification to reintroduce old unverified code**.
10. **W17 qualification**: old `independent-release.js`, `performance-resilience.js`, `security-qualification-envelope.js` had exact-SHA, current evidence and cross-qualification composition; modern qualification files are candidate anchors only. No signoff or performance/penetration test can be inferred.
11. **RIAI strategic asset**: old `calculateStrategicAssetIntelligence` separated lifecycle, attraction, catalysts and subdivision, without authorizing any price or investment decision. Modern `strategic-evidence-governance.js` / lifecycle files need source-aware, non-forecast parity check.

## Internal pipeline outside historic-path triage
- The canonical owner wizard is **partially** joined to the market study; the app has separate study purpose, market date and asset right, yet #774 still demands full five-step valuation/evidence/save/report/economic and browser acceptance.
- Original private `golden-cases-17.json` is **readable through the user's Library**, containing 17 property cases and four *additional calculations*, not four additional standalone property appraisal reports. Independent execution of the **documented generic mathematical formula** reproduces 17/17 values and 17/17 rent outputs, but those rent references are calculated from `marketValue * rentalYieldPct` and therefore do **not** prove market rent or execution of the production engine. The private raw bytes could not be materialized in the current working container, so full exact-engine parity against those originals is still **OPEN**. Keep them outside this public repo.
- C7 Monte Carlo, C22/C23 AI, C24 case orchestration, C26 operator RBAC, C29 shadow simulations have retained source or recovered modules, **but owner UI/report/live operational equivalence still requires independent proof** as described in `STARTAK_RE_FUNCTIONAL_PARITY_MATRIX_20261112.md`.
- The current #800 exact SHA passed [Release Verify 639/639](https://github.com/turkialeid2030/startak-real-estate/actions/runs/43501169365); [One Batch](https://github.com/turkialeid2030/startak-real-estate/actions/runs/43501169417) reported `ALL_STAGES_ENGINEERING=PASS`, `ALL_STAGES_DECISION=HOLD_NOT_AUTHORIZED` and intentionally failed on exit code 2. This does not approve merging/production.
- Main release independent of this draft stack. Do not infer that a green development CI validates deployed Cloudflare assets.

## Zero-closure authorities and external proof
- QCR [#747](https://github.com/turkialeid2030/startak-real-estate/issues/747) Q01-Q12 all OPEN. Each requires three signed/independently corroborated deliverables (36 total); documented independently verified status is **0/36** at review time.
- No verified Saudi executed-sale/lease licensed dataset, holdout accuracy, professional appraiser report approval, signed financial cross-check, identity-backed production tenancy, encrypted production evidence vault, security/PDPL legal opinion, external UAT, recovered incident RCA or final board go-live authority. See [#622](https://github.com/turkialeid2030/startak-real-estate/issues/622), [#648](https://github.com/turkialeid2030/startak-real-estate/issues/648), [#658](https://github.com/turkialeid2030/startak-real-estate/issues/658), [#774](https://github.com/turkialeid2030/startak-real-estate/issues/774).
- 57 historical source paths, 14 G-gates, 36 independent Q-evidence and open PR/issue counts overlap. The sum is **not** a product backlog count.

## Execution register / RACI (proposed)
| Workstream | Responsible | Accountable | Evidence for closure |
| --- | --- | --- | --- |
| P0: classify 37 tree-only source modules; establish 57 source API contracts | Platform engineer / QA | Product technical owner | Per-row source review, API signature, equivalent feature path or explicit retirement, negative tests |
| P0: C8+C9+identity, C3 and all 17+4 reference calculations | Real estate engine developer and QA | Professional valuation lead | Correct same-asset inputs, real source rights, actual engine/oracle diff SAR and report |
| P0: C73 custody, C26 RBAC, W17 qualifications | Security engineer, platform SRE | Security lead | Trusted identity/tenant tests, operational vault evidence, cryptography/KMS, DR, pen test, independent review |
| P1: specialist finance, income, auctions, regulations, parcel options | Finance engineer + legal + specialist valuer | Valuation methodology owner | Repeatable technical calculations, independent licensed source and professional evaluation |
| P1: models, C22/C23, C24, C29, regulated source gateways | AI engineer and data governance lead | Product owner | Real benchmark, source license, cost/quotas, UI/report security, non-authoritative output |
| P0: release gate Q01-Q12 and final main/deployment | Qualified human reviewers and release manager | Authorized decision committee | Signed 36 evidence items, approved exact-SHA merge, production acceptance, rollback proof |

**Engineering handoff sequence:** prioritize the 23 P0 candidates; for *each* row record OLD source API and behavior, MODERN path/interface, equivalence or explicit deprecation rationale, one success+one fail-closed case, exact SHA, UI/report outcome, and reviewer. Keep records HOLD until proofs exist. Then complete P1/P2. Independently, validate private 17+4 on the actual engine and close Q01-Q12 with real evidence. No bulk cherry-pick, no assumed equivalence, no special interest valuation auto-certification, no merge/deploy without authorization.

## Machine-readable and CI
- [57-row source inventory](STARTAK_RE_HISTORIC_SOURCE_CANDIDATES_20261114.csv): historic path, immutable blob, sampled branch, candidate modern source anchor, audit depth, HOLD classification, priority, case acceptance.
- `tests/architecture/run_startak_re_historic_source_parity_register.js` verifies register schema, unique rows, 57 exact path absences, 56 existing modern anchors, 20 source-inspected vs 37 tree-only and that no row claims functional qualification. This is a **consistency/regression test for the audit metadata**, not a proof of functional equivalence.
- **Final state:** all 57 triage entries remain OPEN until evidence. Commercial `HOLD_NOT_AUTHORIZED`. Current main unchanged.
