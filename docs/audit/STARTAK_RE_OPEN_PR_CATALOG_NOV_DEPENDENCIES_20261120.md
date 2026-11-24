# STARTAK Real Estate — سجل طلبات الدمج المفتوحة ومراجعة اعتماديات نوفمبر

> تحديث موثق: 20 نوفمبر 2026. هذا حصر لحالة GitHub، وليس قرار دمج أو نشر. لم تُعدل ملفات التشغيل أو الفرع `main`.

## 1. الحصر الدقيق

- الإجمالي: **110 طلب دمج OPEN** (سبتمبر: 16، أكتوبر: 80، نوفمبر: 14).
- كل طلب دمج مفتوح يمثل قيدًا هندسيًا/توثيقيًا في GitHub وليس وظيفة مستقلة أو عيبًا إضافيًا.
- **لم تُجرَ مراجعة صلاحيات الاعتماد أو الفروق الكاملة لكل طلب**؛ لذلك لا يجوز استنتاج الجاهزية من إدراج الطلب في هذه القائمة.
- تمت مراجعة بيانات `head/base`, Draft, mergeability وعداد الملفات بالتفصيل لطلبات نوفمبر الأربعة عشر، إضافة إلى مرجعي أكتوبر #767 و#764 لتوضيح الاعتماديات العابرة للأشهر.

## 2. التبعيات المعروفة لطلبات نوفمبر

| PR | العنوان | الفرع الأساسي Base | الأب المفتوح المحدد من العينة | Draft | Mergeable تقنيًا | ملفات متغيرة | SHA الرأس |
|---|---|---|---|---|---|---:|---|
| [#772](https://github.com/turkialeid2030/startak-real-estate/pull/772) | test(ui): retain hidden OCR/manual diagnostic reason codes with Arabic assertions | `feature/appraisal-input-gaps-20261030` | [#767](https://github.com/turkialeid2030/startak-real-estate/pull/767) | نعم | لا | 5 | `54c7c74fdbcb` |
| [#773](https://github.com/turkialeid2030/startak-real-estate/pull/773) | Draft: Five-step owner intake — dependent on #767 (no merge/deploy) | `feature/appraisal-input-gaps-20261030` | [#767](https://github.com/turkialeid2030/startak-real-estate/pull/767) | نعم | نعم | 32 | `5680c4ca676b` |
| [#776](https://github.com/turkialeid2030/startak-real-estate/pull/776) | WIP \| STARTAK financial assurance: optional indicators, P25 hold & P27 historical replay | `feature/owner-five-step-wizard-staging-20261106` | [#773](https://github.com/turkialeid2030/startak-real-estate/pull/773) | نعم | نعم | 19 | `9ccc41fc77d1` |
| [#777](https://github.com/turkialeid2030/startak-real-estate/pull/777) | Personal STARTAK \| Kite open MOJ data gateway and research flow | `feature/formula-775-optional-indicators-20261109` | [#776](https://github.com/turkialeid2030/startak-real-estate/pull/776) | نعم | نعم | 134 | `37aa63f8fe02` |
| [#795](https://github.com/turkialeid2030/startak-real-estate/pull/795) | fix(STARTAK RE): fail-closed tenant and source-receipt binding in isolated valuation reports | `integration/personal-data-pipeline-20261110` | [#777](https://github.com/turkialeid2030/startak-real-estate/pull/777) | نعم | نعم | 3 | `eb3d1c45ac2c` |
| [#796](https://github.com/turkialeid2030/startak-real-estate/pull/796) | feat(STARTAK RE): add explicit non-certified sale/disposal valuation-study purpose | `fix/startak-re-report-tenant-evidence-binding-20261113` | [#795](https://github.com/turkialeid2030/startak-real-estate/pull/795) | نعم | نعم | 7 | `3b1a804e3cb3` |
| [#797](https://github.com/turkialeid2030/startak-real-estate/pull/797) | fix(STARTAK RE): block generic full-property values for usufruct and limited rights | `feature/startak-re-sale-study-purpose-20261113` | [#796](https://github.com/turkialeid2030/startak-real-estate/pull/796) | نعم | نعم | 10 | `96d2b0ddd60c` |
| [#798](https://github.com/turkialeid2030/startak-real-estate/pull/798) | fix(STARTAK RE): quarantine secondary research and adjusted-price state across property subjects | `fix/startak-re-limited-interest-owner-indication-hold-20261113` | [#797](https://github.com/turkialeid2030/startak-real-estate/pull/797) | نعم | نعم | 7 | `8fb3bb799c09` |
| [#799](https://github.com/turkialeid2030/startak-real-estate/pull/799) | fix(STARTAK RE): bind Saved Deal research sidecar to property name on save and restore | `fix/startak-re-subject-scope-secondary-reports-20261113` | [#798](https://github.com/turkialeid2030/startak-real-estate/pull/798) | نعم | نعم | 9 | `8e925d37d629` |
| [#800](https://github.com/turkialeid2030/startak-real-estate/pull/800) | fix(STARTAK RE): fail closed stale or duplicate Saved Deal index during research sidecar I/O | `fix/startak-re-sidecar-property-name-binding-20261113` | [#799](https://github.com/turkialeid2030/startak-real-estate/pull/799) | نعم | نعم | 6 | `ae0599b55773` |
| [#801](https://github.com/turkialeid2030/startak-real-estate/pull/801) | audit(STARTAK RE): reconcile 57 historic source paths with modern anchors and protected closure gates | `fix/startak-re-saved-deal-index-record-consistency-20261113` | [#800](https://github.com/turkialeid2030/startak-real-estate/pull/800) | نعم | نعم | 3 | `b51b86988952` |
| [#802](https://github.com/turkialeid2030/startak-real-estate/pull/802) | fix(STARTAK RE): reject implicit title-source conflicts and untraceable required facts | `audit/startak-re-legacy-functional-disposition-20261114` | [#801](https://github.com/turkialeid2030/startak-real-estate/pull/801) | نعم | نعم | 2 | `ef1bde52ee8e` |
| [#803](https://github.com/turkialeid2030/startak-real-estate/pull/803) | security(STARTAK RE): enforce same-tenant workspace object ownership and deny peer IDOR | `fix/startak-re-title-fact-cross-source-integrity-20261114` | [#802](https://github.com/turkialeid2030/startak-real-estate/pull/802) | نعم | نعم | 23 | `1aeb0c2a7bb8` |
| [#805](https://github.com/turkialeid2030/startak-real-estate/pull/805) | docs(audit): comprehensive STARTAK RE open-work register — 98 issues / 109 PRs | `security/hardening-v1` | [#803](https://github.com/turkialeid2030/startak-real-estate/pull/803) | نعم | نعم | 1 | `55aad08325ad` |

- تظهر **14** علاقات اعتماد على PR مفتوح آخر ضمن العينة المحدودة؛ خانة «غير محسوم» **لا تعني الاعتماد على main أو الاستقلال**، بل تتطلب ربط الفرع الأساسي بكل سجل التاريخ/الفروع المقابلة.
- `mergeable=true` يعني عدم ظهور تعارض Git في تلك اللقطة فقط، ولا يساوي مراجعة أو صلاحية أو قبول أمان أو موافقة على الدمج.

## 3. قائمة جميع الطلبات المفتوحة (110)

### سبتمبر (16)

- [PR #461](https://github.com/turkialeid2030/startak-real-estate/pull/461) — P25: fail closed undocumented critical assumption overrides
- [PR #463](https://github.com/turkialeid2030/startak-real-estate/pull/463) — P27: version current-model reference corpus
- [PR #466](https://github.com/turkialeid2030/startak-real-estate/pull/466) — C1: official geospatial evidence foundation
- [PR #469](https://github.com/turkialeid2030/startak-real-estate/pull/469) — C2: official market evidence & comparable transactions foundation
- [PR #471](https://github.com/turkialeid2030/startak-real-estate/pull/471) — C3: governed valuation reconciliation foundation
- [PR #473](https://github.com/turkialeid2030/startak-real-estate/pull/473) — C3M: whole-property market sales comparison foundation
- [PR #476](https://github.com/turkialeid2030/startak-real-estate/pull/476) — C2S: governed source intelligence and evidence provenance registry
- [PR #477](https://github.com/turkialeid2030/startak-real-estate/pull/477) — C3I/C2S: governed source provenance before three-approach reconciliation
- [PR #479](https://github.com/turkialeid2030/startak-real-estate/pull/479) — C4: governed deal decision and report integration
- [PR #481](https://github.com/turkialeid2030/startak-real-estate/pull/481) — C5: governed decision UI and export integration
- [PR #483](https://github.com/turkialeid2030/startak-real-estate/pull/483) — C6: browser E2E and controlled human review workflow
- [PR #485](https://github.com/turkialeid2030/startak-real-estate/pull/485) — C7: governed correlated Monte Carlo risk simulation
- [PR #487](https://github.com/turkialeid2030/startak-real-estate/pull/487) — C8: governed title / survey / property-evidence verification
- [PR #489](https://github.com/turkialeid2030/startak-real-estate/pull/489) — C9: governed urban code / plot feasibility
- [PR #491](https://github.com/turkialeid2030/startak-real-estate/pull/491) — C10: governed market interpretation / liquidity
- [PR #493](https://github.com/turkialeid2030/startak-real-estate/pull/493) — C11: governed income asset intelligence / rent-roll concentration

### أكتوبر (80)

- [PR #495](https://github.com/turkialeid2030/startak-real-estate/pull/495) — C12: governed regulatory carry cost intelligence
- [PR #498](https://github.com/turkialeid2030/startak-real-estate/pull/498) — C13: governed encumbrance / mortgage / closing intelligence
- [PR #501](https://github.com/turkialeid2030/startak-real-estate/pull/501) — C14: governed financing option comparison / optimization intelligence
- [PR #503](https://github.com/turkialeid2030/startak-real-estate/pull/503) — C15: governed rental regulation intelligence
- [PR #505](https://github.com/turkialeid2030/startak-real-estate/pull/505) — C2N: governed non-API source acquisition and municipal geospatial registry
- [PR #507](https://github.com/turkialeid2030/startak-real-estate/pull/507) — C16: governed auction acquisition intelligence
- [PR #509](https://github.com/turkialeid2030/startak-real-estate/pull/509) — C17: governed raw land strategic optionality intelligence
- [PR #511](https://github.com/turkialeid2030/startak-real-estate/pull/511) — C18: governed subdivision and merge review intelligence
- [PR #514](https://github.com/turkialeid2030/startak-real-estate/pull/514) — C19: governed policy shock and comparable-impact intelligence
- [PR #516](https://github.com/turkialeid2030/startak-real-estate/pull/516) — C20: governed urban growth and accessibility intelligence
- [PR #518](https://github.com/turkialeid2030/startak-real-estate/pull/518) — C21: governed listing transparency and amenity utility intelligence
- [PR #520](https://github.com/turkialeid2030/startak-real-estate/pull/520) — C22: governed AI and generative intelligence orchestration
- [PR #523](https://github.com/turkialeid2030/startak-real-estate/pull/523) — C23: governed live AI provider gateway and proof-grounded output enforcement
- [PR #525](https://github.com/turkialeid2030/startak-real-estate/pull/525) — C24: integrated case/property orchestration and hard-gate state machine
- [PR #527](https://github.com/turkialeid2030/startak-real-estate/pull/527) — C25: production source operational readiness, rights, freshness and schema-drift governance
- [PR #530](https://github.com/turkialeid2030/startak-real-estate/pull/530) — C26: governed operator workspace, RBAC and human-review access controls
- [PR #532](https://github.com/turkialeid2030/startak-real-estate/pull/532) — C27: governed observability, redaction and operational safety telemetry
- [PR #536](https://github.com/turkialeid2030/startak-real-estate/pull/536) — C28: comprehensive integration, security and adversarial qualification freeze
- [PR #537](https://github.com/turkialeid2030/startak-real-estate/pull/537) — C29: governed shadow simulation, historical replay and UAT evidence harness
- [PR #538](https://github.com/turkialeid2030/startak-real-estate/pull/538) — C26 UI closure: governed integrated case review surface and production wiring
- [PR #539](https://github.com/turkialeid2030/startak-real-estate/pull/539) — C30: governed release-candidate freeze and GO/HOLD/NO-GO evidence pack
- [PR #542](https://github.com/turkialeid2030/startak-real-estate/pull/542) — Post-C30: harden browser review runtime, crypto boundary and bundle threshold
- [PR #544](https://github.com/turkialeid2030/startak-real-estate/pull/544) — Post-C30: migrate Vite config to explicit ESM native-loader compatibility
- [PR #553](https://github.com/turkialeid2030/startak-real-estate/pull/553) — C30: external evidence collection pack and fail-closed intake validator
- [PR #554](https://github.com/turkialeid2030/startak-real-estate/pull/554) — C30: verify byte integrity of staged external evidence artifacts
- [PR #555](https://github.com/turkialeid2030/startak-real-estate/pull/555) — C30: final external evidence handoff and independent-decision boundary
- [PR #557](https://github.com/turkialeid2030/startak-real-estate/pull/557) — C31: canonical evidence readiness and fail-closed activation handoff
- [PR #565](https://github.com/turkialeid2030/startak-real-estate/pull/565) — C32: 13-item evidence acquisition program and consolidated blocker ledger
- [PR #567](https://github.com/turkialeid2030/startak-real-estate/pull/567) — C33: evidence request packets and owner-assignment outreach handoff
- [PR #569](https://github.com/turkialeid2030/startak-real-estate/pull/569) — C34: assign single accountable owner while preserving independence boundaries
- [PR #589](https://github.com/turkialeid2030/startak-real-estate/pull/589) — C35: owner execution wave 1 and controlled rollback rehearsal
- [PR #591](https://github.com/turkialeid2030/startak-real-estate/pull/591) — C36: persist rollback candidate evidence and independent review handoff
- [PR #593](https://github.com/turkialeid2030/startak-real-estate/pull/593) — C37: designate Said for rollback independent review
- [PR #595](https://github.com/turkialeid2030/startak-real-estate/pull/595) — C38: signed rollback review intake verification
- [PR #597](https://github.com/turkialeid2030/startak-real-estate/pull/597) — C39: historical evidence reuse eligibility audit
- [PR #600](https://github.com/turkialeid2030/startak-real-estate/pull/600) — C42: external gate closure control
- [PR #601](https://github.com/turkialeid2030/startak-real-estate/pull/601) — C43: exact-candidate external review handoff packets
- [PR #602](https://github.com/turkialeid2030/startak-real-estate/pull/602) — C44: current governed source-rights review register
- [PR #603](https://github.com/turkialeid2030/startak-real-estate/pull/603) — C45: internal source-rights advisory review
- [PR #604](https://github.com/turkialeid2030/startak-real-estate/pull/604) — C46: internal security review and hardening
- [PR #605](https://github.com/turkialeid2030/startak-real-estate/pull/605) — C47: internal privacy and PDPL readiness hardening
- [PR #606](https://github.com/turkialeid2030/startak-real-estate/pull/606) — C48: internal AI provider production-readiness hardening
- [PR #607](https://github.com/turkialeid2030/startak-real-estate/pull/607) — C49: internal official source data rights readiness
- [PR #608](https://github.com/turkialeid2030/startak-real-estate/pull/608) — C50: internal human UAT readiness
- [PR #609](https://github.com/turkialeid2030/startak-real-estate/pull/609) — C51: internal historical replay readiness
- [PR #611](https://github.com/turkialeid2030/startak-real-estate/pull/611) — C52: Private Alpha governance and non-API acquisition
- [PR #612](https://github.com/turkialeid2030/startak-real-estate/pull/612) — C53: executable Private Alpha source acquisition runtime
- [PR #613](https://github.com/turkialeid2030/startak-real-estate/pull/613) — C54: fail-closed market comparable decision qualification
- [PR #617](https://github.com/turkialeid2030/startak-real-estate/pull/617) — C55 Stage 1: independently dated unlevered development residual with anti-double-count gates
- [PR #623](https://github.com/turkialeid2030/startak-real-estate/pull/623) — C56 Stage 1: sealed Saudi historical valuation cohort with C51/C30 hard gates
- [PR #624](https://github.com/turkialeid2030/startak-real-estate/pull/624) — C57 Stage 1: no-drop real asset-sector E2E and human evidence intake matrix
- [PR #625](https://github.com/turkialeid2030/startak-real-estate/pull/625) — C58 Stage 1: anti-tamper comparable evidence chain and non-bypassable source-bound hold
- [PR #626](https://github.com/turkialeid2030/startak-real-estate/pull/626) — C59 Stage 1: component-level physical, functional and external obsolescence reconciliation
- [PR #627](https://github.com/turkialeid2030/startak-real-estate/pull/627) — C60 Stage 1: independently reviewable Saudi cap, exit and discount-rate evidence
- [PR #629](https://github.com/turkialeid2030/startak-real-estate/pull/629) — C61 Stage 1: bind hotel interest/NOI and industrial operating compliance evidence
- [PR #630](https://github.com/turkialeid2030/startak-real-estate/pull/630) — C62 Stage 1: wire C58-C61 HOLD into actual Valuation V1 existing-building runtime and Arabic UI
- [PR #631](https://github.com/turkialeid2030/startak-real-estate/pull/631) — C63 Stage 1: execute real Chromium Arabic valuation HOLD/save/reload journeys for office, retail and residential
- [PR #635](https://github.com/turkialeid2030/startak-real-estate/pull/635) — C65: render Arabic/English institutional HOLD reasons without losing C62 audit codes
- [PR #636](https://github.com/turkialeid2030/startak-real-estate/pull/636) — C64 stage 1: real Chromium land/development HOLD, save and reload; no false professional approval
- [PR #637](https://github.com/turkialeid2030/startak-real-estate/pull/637) — C66: watched-build local developer preview fallback; native Vite CommonJS bug remains open
- [PR #638](https://github.com/turkialeid2030/startak-real-estate/pull/638) — C67: test native Vite 8 experimental bundled dev in real Chromium without browser require shim
- [PR #639](https://github.com/turkialeid2030/startak-real-estate/pull/639) — C68: fix bundledDev Tailwind hotUpdate incompatibility; prove real React land notice HMR
- [PR #640](https://github.com/turkialeid2030/startak-real-estate/pull/640) — C69: real hotel/industrial classification intake with explicit no-specialist-value HOLD and Chromium save/reload
- [PR #641](https://github.com/turkialeid2030/startak-real-estate/pull/641) — C70: live hotel and industrial evidence-reference intake wired to real C61 HOLD, with browser save/reload
- [PR #642](https://github.com/turkialeid2030/startak-real-estate/pull/642) — C71: canonical C5/C6 analyst export HOLD for unqualified hotel, industrial and mixed-use; real JSON browser verification
- [PR #643](https://github.com/turkialeid2030/startak-real-estate/pull/643) — C72: locally hash real selected hotel/industrial document bytes; persist unverified scoped fingerprints, maintain C61/C71 HOLD
- [PR #645](https://github.com/turkialeid2030/startak-real-estate/pull/645) — C74: whole-system deterministic real estate simulation, Arabic/English Chromium journeys and fail-closed governance
- [PR #646](https://github.com/turkialeid2030/startak-real-estate/pull/646) — C73.1: server-only signed evidence custody and adversarial integrity tests (external trust HOLD)
- [PR #647](https://github.com/turkialeid2030/startak-real-estate/pull/647) — C73.2: real PostgreSQL custody head, FORCE RLS isolation and concurrent anti-replay tests
- [PR #649](https://github.com/turkialeid2030/startak-real-estate/pull/649) — C73.3A: verified RSA bearer HTTP custody gateway with actual PostgreSQL integration
- [PR #650](https://github.com/turkialeid2030/startak-real-estate/pull/650) — C73.3B: bounded AES-256-GCM encrypted staging with real disk, scanner hard gate and tenant isolation
- [PR #651](https://github.com/turkialeid2030/startak-real-estate/pull/651) — C73.3C: signed independent-process Ed25519 witness rejects valid PostgreSQL rollback
- [PR #652](https://github.com/turkialeid2030/startak-real-estate/pull/652) — C73.3D: authenticated Ed25519 witness with restart-persistent signed checkpoint journal and replay denial
- [PR #653](https://github.com/turkialeid2030/startak-real-estate/pull/653) — C73.4: signed eight-domain P0 evidence hard gate; never grant production from synthetic proof
- [PR #654](https://github.com/turkialeid2030/startak-real-estate/pull/654) — C73.5: require 2-of-3 pinned offline-root approval of external P0 reviewer keys
- [PR #655](https://github.com/turkialeid2030/startak-real-estate/pull/655) — C75: Personal real-estate investment research, Arabic HTML/JSON exports without enterprise approval
- [PR #763](https://github.com/turkialeid2030/startak-real-estate/pull/763) — STARTAK: location input, compound composition and source-bound market sale/rent scenarios
- [PR #764](https://github.com/turkialeid2030/startak-real-estate/pull/764) — STARTAK — unified appraisal integrity, sector evidence, market holdout and private-vault contract (draft)
- [PR #766](https://github.com/turkialeid2030/startak-real-estate/pull/766) — STARTAK D01–D07 — bilingual research reports and current-case evidence integrity
- [PR #767](https://github.com/turkialeid2030/startak-real-estate/pull/767) — Add whole-property sale/rent journey and appraisal evidence controls

### نوفمبر (14)

- [PR #772](https://github.com/turkialeid2030/startak-real-estate/pull/772) — test(ui): retain hidden OCR/manual diagnostic reason codes with Arabic assertions
- [PR #773](https://github.com/turkialeid2030/startak-real-estate/pull/773) — Draft: Five-step owner intake — dependent on #767 (no merge/deploy)
- [PR #776](https://github.com/turkialeid2030/startak-real-estate/pull/776) — WIP | STARTAK financial assurance: optional indicators, P25 hold & P27 historical replay
- [PR #777](https://github.com/turkialeid2030/startak-real-estate/pull/777) — Personal STARTAK | Kite open MOJ data gateway and research flow
- [PR #795](https://github.com/turkialeid2030/startak-real-estate/pull/795) — fix(STARTAK RE): fail-closed tenant and source-receipt binding in isolated valuation reports
- [PR #796](https://github.com/turkialeid2030/startak-real-estate/pull/796) — feat(STARTAK RE): add explicit non-certified sale/disposal valuation-study purpose
- [PR #797](https://github.com/turkialeid2030/startak-real-estate/pull/797) — fix(STARTAK RE): block generic full-property values for usufruct and limited rights
- [PR #798](https://github.com/turkialeid2030/startak-real-estate/pull/798) — fix(STARTAK RE): quarantine secondary research and adjusted-price state across property subjects
- [PR #799](https://github.com/turkialeid2030/startak-real-estate/pull/799) — fix(STARTAK RE): bind Saved Deal research sidecar to property name on save and restore
- [PR #800](https://github.com/turkialeid2030/startak-real-estate/pull/800) — fix(STARTAK RE): fail closed stale or duplicate Saved Deal index during research sidecar I/O
- [PR #801](https://github.com/turkialeid2030/startak-real-estate/pull/801) — audit(STARTAK RE): reconcile 57 historic source paths with modern anchors and protected closure gates
- [PR #802](https://github.com/turkialeid2030/startak-real-estate/pull/802) — fix(STARTAK RE): reject implicit title-source conflicts and untraceable required facts
- [PR #803](https://github.com/turkialeid2030/startak-real-estate/pull/803) — security(STARTAK RE): enforce same-tenant workspace object ownership and deny peer IDOR
- [PR #805](https://github.com/turkialeid2030/startak-real-estate/pull/805) — docs(audit): comprehensive STARTAK RE open-work register — 98 issues / 109 PRs

## 4. مخرجات العمل قبل الدمج

1. مقارنة أي PR متسلسل بالفرع الأساسي الفعلي، وفحص فروق المصدر والاختبارات لإثبات عدم تكرار التعديلات أو إسقاط وظائف قديمة.
2. مراجعة الـ96 PR الأقدم مراجعة تفصيلية لمعلومات `base/head`, ونوع التغيير والتعارضات، ثم إعداد ترتيب دمج topological؛ هذا **عمل مفتوح** وليس مكتملًا بموجب هذا الحصر.
3. مراجعة PR #801 مقابل قائمة المسارات التاريخية الـ57 بدليل تشغيل حقيقي قبل اعتبار تكافؤ النسخ مكتملًا.
4. إثبات التشغيل الحي للهوية/عزل المؤسسات، ومطابقة 17 حالة خاصة على محرك التقييم، وحقوق بيانات السوق السعودي، والاستعادة والاختراق المستقل واعتمادات Q01–Q12.
5. **الحالة الحاكمة:** كل طلبات الدمج تبقى كما هي؛ لا `main` merge ولا production deploy ولا إغلاق قضية لمجرد CI. `HOLD_NOT_AUTHORIZED`.

## 5. حدود المصادر

- قائمة الطلبات 110 جرى جلبها ببحث مباشر عن PRs المفتوحة بتاريخ اليوم، في ثلاث نوافذ غير متداخلة.
- رأس الفرع وعلاقة الأب الفنية مؤكدة فقط لعينة نوفمبر مع المرجعين المذكورين؛ لا ادعاء بأن الرسم البياني للـ110 قد اكتمل.
- مستندات اعتمادات الجهات والوثائق العقارية الخاصة تبقى خارج GitHub؛ لا يجوز اعتبار الغياب عن هذا التقرير دليل عدم وجودها خارج المستودع.
