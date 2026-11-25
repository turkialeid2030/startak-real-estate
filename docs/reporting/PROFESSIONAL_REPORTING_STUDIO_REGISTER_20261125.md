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
| PR13 | OPEN | ESG artifact contract is not an implemented comprehensive assessment | evidence-based ESG scope, unknown/not-applicable distinctions, no unsupported value adjustment |
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
| PR23 | OPEN | demolition and redevelopment feasibility, permit and cost evidence not implemented in this increment |
| PR24 | PARTIAL | reported delta only; market attribution explicitly unavailable, component sum checks; causal decomposition open |
| PR25 | PARTIAL | ASKING / EXECUTED / UNKNOWN separated, no executed comparables warning, distinct source references; actual market verification and admission open |
| PR26 | PARTIAL | staged building-rights adjustment, declared planning evidence, duplicate category rejection; independently verified zoning and capacity open |
| PR27 | PARTIAL | inspection, valuation, issue, worksheet, limitations and comparable/observation date checks; source authenticity open |
| PR28 | PARTIAL | declared symmetric sensitivity, explicitly not a confidence interval; calibrated uncertainty open |
| PR29 | PARTIAL | local transcribed review only, existing linked appraisal export gate retained; institutional rights and confidential storage open |
| PR30 | PARTIAL | synthetic permanent tests and private in-memory arithmetic replay; original-document attestation and full corpus page-level review open |

Vacant-land diagnostic accepts no building-cost inputs, supports two sequential stages of unique categorized adjustments, preserves weighted numerator before final rate rounding, and distinguishes declared source labels from verified evidence. It does not adopt a valuation or establish transaction authority. Historical comparison never infers market growth from reported deltas. Studio exports remain local printable HTML through the existing download gate. Native new candidate build/browser execution and independent evidence remain pending. Exact isolated module replay: existing reporting 40 cases/141 checks, new land/history 41 cases/148 checks, total 81/289. Private transcribed arithmetic reproduced all four adjusted rates and declared final value; exact aggregate reconciliation, no confidential fixture committed. No package closed or release authorization.
