# Professional Reporting Studio — implementation register

Baseline: 71f279f10ff2c5f1c72b3dbbdee2ee57329cb958 (qualified stacked candidate). This separate branch must not disturb baseline or authorize release. Source reference is a confidential external valuation report reviewed locally; no original report, proprietary narrative, client identifiers, coordinates, photos, certificates, private fixture values or attachments are committed.

Status codes: FOUNDATION = existing component, integration unqualified; PARTIAL = new limited implementation, not full acceptance; OPEN = not implemented/verified in this increment. No package is closed.

| Package | State | Reuse / new scope | Remaining acceptance |
|---|---|---|---|
| PR01 | FOUNDATION | src/standards; professional-report-contract | verify authoritative effective editions, local requirements and dated applicability |
| PR02 | FOUNDATION | valuation-assignment and professional report contract | assignment UI, scope, assumptions, conflict declarations and auditable approval |
| PR03 | FOUNDATION | valuation case/classification | component/unit register, renovation status, full property identity |
| PR04 | FOUNDATION | property-data-conflict-gate, measurement-governance | reconcile original deed, plan, permit and geometry; no auto winner |
| PR05 | FOUNDATION | inspection-lifecycle | field workflow, categorized verified media, private attachments |
| PR06 | PARTIAL | external-report-review | strict transcribed inputs, arithmetic flags and page references; automated extraction and human review still open |
| PR07 | PARTIAL | existing comparable provenance and adjustment engines | two-stage replay with age/area warnings and no automatic market adoption; detailed adjustment categories and independent exceptions open |
| PR08 | PARTIAL | existing cost and depreciation attribution | component quantity/unit/cost and physical age-life replay; functional/external losses, mixed-unit reconciliation and CAPEX overlap open |
| PR09 | FOUNDATION | existing specialist DCF and operating research, valuation runtime | unify all validated outputs, financials and source-bound specialist attachments |
| PR10 | PARTIAL | external-report-review | exact weighted numerator, displayed rate, land delta and disclosed rounding; multiple method reconciliation, approval and written amount open |
| PR11 | PARTIAL | reporting-studio + existing personal report generator | two printable local HTML layouts, external review HTML; PDF pagination, cover, contents, preview, redaction and complete section mapping open |
| PR12 | FOUNDATION | professional-review, authenticated-reporting-service, report-conformance-qa; reuse appraisal-report-export gate | server-side authority, tenant isolation and independent professional QA |
| PR13 | PARTIAL | shared existing ESG taxonomy; local declared screening across 11 core factors, optional OTHER, explicit five outcomes, dates and impact channels; separate existing professional evidence gate | verified evidence, sector-specific extensions, materiality and market linkage, professional review and institutional persistence open |
| PR14 | FOUNDATION | geospatial-evidence and source governance | verified maps/POIs, geometry, provenance and licensed static maps |
| PR15 | OPEN | deterministic HTML labels are not a generative narrative engine | evidence-bound narrative, factual claims checks, privacy, live AI acceptance |
| PR16 | PARTIAL | owner and technical research HTML | board decision pack, concise owner commentary, financial/risk appendices |
| PR17 | OPEN | no slide generation in this increment | customer/investor and board presentation templates, confidentiality and audience-specific data minimization |
| PR18 | PARTIAL | local manual structured input review only | PDF OCR/table extraction, traceability to source pages/regions, source authenticity, comparison across appraisals |
| PR19 | FOUNDATION | existing artifact hashes and review workflow | version history, authenticated digital signatures, authorized registry integration and verification |
| PR20 | PARTIAL | synthetic arithmetic/HTML regression plus 3-browser matrix | exact SHA native build, browser/print acceptance, security/authority/tenant/production gates |

## Scope of first increment

- External report review is a diagnostic replay, not an appraisal or independently authenticated market evidence. It requires explicit typed input (never automatic source adoption). Only sequential percentage adjustments, a physical age-life calculation and the declared final value are replayed.
- Weighted numerator is retained before final display-rate rounding; land delta is derived from unrounded weighted rate. Displayed individual contributions are rounded to halalas. No canonical formulas changed.
- Local research HTML is generated from the existing C75 valuation research builder, with owner and technical layouts. It does not replace the existing financial study, governed JSON, or professional contract. All new UI downloads enforce the existing linked appraisal export hold. The review is not automatically bound to the canonical case, and no storage or external network is introduced.
- No proof of PDF rendering, professional accreditation, signed report, verified market source, original-document integrity, official registration or external issuance. No AI provider is invoked. All committed fixtures are synthetic.
- Native CI on the exact new candidate, full source-to-report trace, 47-page requirement coverage, Arabic/English print and browser testing, private case validation, and human acceptance remain required. Release HOLD.

## Verification

Run node tests/defects/reporting_studio.js; browser workflow reporting-studio-browser.yml executes the same regression and the three-engine local-preview acceptance across two locales and three widths. Counts refer to the actual execution environment, not overall project completion.

## Expanded approved scope PR21–PR30 (2026-11-25)
Private reference corpus: 15 reports / 991 pages as inventoried, not all independently reviewed. The private reports and source values remain outside this public repository.

| Package | State | Implemented / remaining |
|---|---|---|
| PR21 | PARTIAL | two dated property snapshots with physical state and declared transition evidence; full lifecycle event ledger and persistence open |
| PR22 | PARTIAL | identity-bound reported-value comparison with changed basis, purpose, right and method; full historical registry open |
| PR23 | PARTIAL | owner sell/retain/redevelop research with common horizon, opportunity-cost DCF, annual demolition and construction timing, downside and source declarations; independent permits, cost evidence, development capacity, financing and approval open |
| PR24 | PARTIAL | reported delta only; market attribution explicitly unavailable, component sum checks; causal decomposition open |
| PR25 | PARTIAL | ASKING / EXECUTED / UNKNOWN separated, no executed comparables warning, distinct source references; actual market verification and admission open |
| PR26 | PARTIAL | staged building-rights adjustment, declared planning evidence, duplicate category rejection; independently verified zoning and capacity open |
| PR27 | PARTIAL | inspection, valuation, issue, worksheet, limitations and comparable/observation date checks; source authenticity open |
| PR28 | PARTIAL | declared symmetric sensitivity, explicitly not a confidence interval; calibrated uncertainty open |
| PR29 | PARTIAL | local transcribed review only, existing linked appraisal export gate retained; institutional rights and confidential storage open |
| PR30 | PARTIAL | synthetic permanent tests and private in-memory arithmetic replay; original-document attestation and full corpus page-level review open |

Vacant-land diagnostic accepts no building-cost inputs, supports two sequential stages of unique categorized adjustments, preserves weighted numerator before final rate rounding, and distinguishes declared source labels from verified evidence. It does not adopt a valuation or establish transaction authority. Historical comparison never infers market growth from reported deltas. Studio exports remain local printable HTML through the existing download gate. Native new candidate build/browser execution and independent evidence remain pending. Exact isolated module replay: existing reporting 40 cases/141 checks, new land/history 41 cases/148 checks, total 81/289. Private transcribed arithmetic reproduced all four adjusted rates and declared final value; exact aggregate reconciliation, no confidential fixture committed. No package closed or release authorization.

## PR23 continuation
Previous exact candidate fac720b: native reporting browser matrix 18/18 configurations passed (three engines, two languages, three widths), 81/289 regression on each engine; One Batch engineering PASS with intentional exit 2 HOLD. New PR23 owner alternative engine is pre-tax, unlevered, current freehold owner only. Net immediate sale proceeds are the opportunity cost once, not an acquisition or a value adopted from external appraisal. Explicit year-zero costs, common exit horizon, phased demolition and construction, no rental income during redevelopment, cost/revenue/exit downside, canonical precise NPV and governed IRR diagnostics; no recommendation or permit authority. New 30 cases/74 checks passed in isolated exact-source JS, prior 81/289 re-run PASS, total 111/363. New native regression and browser journeys configured, not yet qualified. No private data used in permanent fixtures, no changes to canonical financial engines, no merge or release. Remaining PR23 scope includes verified building rights, physical/legal feasibility, actual cost and income evidence, development finance, institutional custody, professional approval.

## PR13 continuation
New declared ESG research screening reuses taxonomy extracted unchanged from existing professional evidence module. Missing factors default to UNKNOWN, not a zero impact; non-unknown outcomes require source class/reference/date and rationale; material/potential outcomes require impact channels. Flags future, stale (365-day research heuristic), expired and assumed sources. No ESG score, numeric adjustment, canonical model adoption, compliance or approval. Bilingual HTML and UI use existing export gate. Isolated exact-source regression 85 cases/976 checks (including 55 extra follow-up checks after correction); previous 111 cases/363 checks passed before correction. Native legacy evidence and new browser acceptance configured; results pending. 30-package program remains open. No private fixture data committed.

## Approved expansion PR31–PR40 — STARTAK Rental Intelligence
| Package | State | Implemented / remaining |
|---|---|---|
| PR31 | PARTIAL | independent local research rental engine, 20 type codes, as-of date, annual/monthly SAR ex VAT, per-unit and per-area indications; dedicated structured workflow and current data still open |
| PR32 | OPEN | licensed Saudi indicator registry, official geography codes and reproducible historical snapshots |
| PR33 | OPEN | real authorized connectors, credentials in server custody, source terms and live request acceptance; no fabricated live data |
| PR34 | PARTIAL | bounded categorized additive adjustments with evidence refs; sector-specific calibrated adjustment models and lease incentive normalization open |
| PR35 | OPEN | licensed geospatial market data and heatmaps |
| PR36 | PARTIAL | declared disjoint homogeneous segments, per-unit quantities, complete mixed-use totals only when all segments supported; prevent duplicated current contracts and mixed measurement denominators; advanced unit-level UI open |
| PR37 | OPEN | calibrated automated rental valuation, holdout evaluation, uncertainty model, monitoring and versioned methodology |
| PR38 | PARTIAL | explicitly declared VAT-inclusive amount normalized to annual nominal rent-only ex VAT; unknown VAT withheld; legal rent and applicable VAT remain null, not legal advice or assumed law; official dated rule evaluation pending |
| PR39 | PARTIAL | local bilingual printable HTML with cohort details, adjustments, exclusions, observed range and limitations; existing export gate enforced; professional PDF and standalone route open |
| PR40 | PARTIAL | synthetic 70 scenarios / 464 checks passed in isolated exact committed JS with fixture-only URL and UTF-8 adapters; native build/browser tests configured; live and independently verified market evidence, out-of-sample accuracy and private corpus calibration remain open |

### Rental research methodology and limits
Inputs are manually provided with source references; no live data retrieval or authenticated lease verification. Same declared city/district/subtype/area basis, size ratio 0.5–2, as-of date and observation date, 365-day window and 5 km when both coordinates provided are conservative research heuristics, not mandated or validated standards. Require 3 distinct declared executed leases per segment; asking cohort separately shown, no automatic fallback. Contradictory stable source/contract identities hold aggregate, exact duplicates removed. Nominal annualized rent-only before tax, not effective rent after incentives; declared VAT included normalized by declared rate, not a determination of actual tax liability. Median of adjusted rates, min/max observed indicators, not confidence bounds. Occupancy/collection assumptions separate from rent; no NOI or adoption. No market guarantee, legal rent, certification, transaction authority or canonical write. Specialized assets require property-only leases, never business income. Mixed measurement basis prevents aggregate per-square-meter rate and area. Inputs remain local, example synthetic. All five reporting suites re-run: 266 scenarios / 1803 checks in isolated JS (native browser build pending), no professional or live-market acceptance. Native workflow includes the new rental suite and browser journeys. No confidential values or keys committed. Existing qualified PR #834 unchanged. HOLD release.
