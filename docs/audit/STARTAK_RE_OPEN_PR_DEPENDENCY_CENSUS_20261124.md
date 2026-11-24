# STARTAK Real Estate — التعداد الحي لجميع طلبات الدمج ومخطط التبعيات
**التاريخ:** 24 نوفمبر 2026، توقيت الرياض. **المستودع:** `turkialeid2030/startak-real-estate`.
**المنهج:** صفحتان من واجهة GitHub `pulls?state=open` (100 + المتبقي)، ونتيجة `is:issue is:open`، وربط `base.ref` ب`head.ref` لطلبات الدمج المفتوحة فقط.

> **تنبيه:** مخطط التبعيات لا يفحص الاختلافات المنطقية في الشيفرة أو الأكواد المفقودة عبر الفروع المغلقة. هو جرد إداري/هندسي، وليس تصريح دمج أو نشر أو تكافؤ عمل.

## النتيجة المباشرة
- الطلبات المفتوحة: **127**، منها مسودات **123** وغير مسودات **4**. القضايا المفتوحة **98**.
- جذور السلاسل **4**، وروابط الأب المباشر داخل الطلبات المفتوحة **123**، دون دورة مكتشفة في المخطط.
- زاد العدد من **110** في جرد 20 نوفمبر إلى **125** ثم **126** في جرد 23 نوفمبر إلى **127** الآن؛ إحصاءات الأيام السابقة صحيحة بوقتها فقط.
- [#822](https://github.com/turkialeid2030/startak-real-estate/pull/822) فوق #821 ثم #820؛ هندسته الشخصية دون API مختبرة في المسودة، لكنه **ليس إصدار main أو إنتاجًا**.
- [#461](https://github.com/turkialeid2030/startak-real-estate/pull/461) و[#772](https://github.com/turkialeid2030/startak-real-estate/pull/772) كانا `mergeable=false` في آخر تحقق، ويتطلبان مراجعة اختلافات محددة؛ لا تجاوز بالقوة.
- #461 و#463 متفرعان عن تاريخ مختلف، ولكلٍّ منهما 412 التزامًا متأخرًا عن `main` في المقارنة المؤكدة بتاريخ 24 نوفمبر؛ لا يجوز دمج التاريخ ماليًا دون فحص المعاني والاختبارات.
- احتواء Git لنسخ #763/#764/#766 لا يكفي لإثبات تشغيل 57 وظيفة قديمة أو حمايتها من التحولات الدلالية.

## السلاسل الرئيسية

| PR الجذر | مرجع القاعدة | الطلبات المفتوحة ضمن العائلة | عمق التبعية |
|---|---|---:|---:|
| [#463](https://github.com/turkialeid2030/startak-real-estate/pull/463) | `p26-financial-timing-basis-disclosure` | 91 | 90 |
| [#767](https://github.com/turkialeid2030/startak-real-estate/pull/767) | `main` | 32 | 28 |
| [#763](https://github.com/turkialeid2030/startak-real-estate/pull/763) | `main` | 3 | 2 |
| [#461](https://github.com/turkialeid2030/startak-real-estate/pull/461) | `main` | 1 | 0 |

## كل طلبات الدمج المفتوحة

| PR | الوضع | رأس الالتزام | قاعدة PR | PR الأب المفتوح | الجذر | العمق |
|---|---|---|---|---|---|---:|
| [#822](https://github.com/turkialeid2030/startak-real-estate/pull/822) | مسودة | `96c4743fd064` | `fix/startak-re-qualification-subject-scope-invalid-date-20261123` | #821 | #767 | 28 |
| [#821](https://github.com/turkialeid2030/startak-real-estate/pull/821) | مسودة | `438e1a2da6af` | `fix/startak-re-national-source-url-privacy-gate-20261123` | #820 | #767 | 27 |
| [#820](https://github.com/turkialeid2030/startak-real-estate/pull/820) | مسودة | `9d2b81f26c47` | `fix/startak-re-evidence-full-identifier-dedupe-20261123` | #819 | #767 | 26 |
| [#819](https://github.com/turkialeid2030/startak-real-estate/pull/819) | مسودة | `851f688402a8` | `feat/startak-re-evidence-qualification-review-gate-20261122` | #818 | #767 | 25 |
| [#818](https://github.com/turkialeid2030/startak-real-estate/pull/818) | مسودة | `8a4ba3575dc2` | `feat/startak-re-no-api-human-source-bridge-20261122` | #817 | #767 | 24 |
| [#817](https://github.com/turkialeid2030/startak-real-estate/pull/817) | مسودة | `4c408f6d7d07` | `fix/startak-re-umaps-official-source-20261122` | #815 | #767 | 23 |
| [#816](https://github.com/turkialeid2030/startak-real-estate/pull/816) | مسودة | `d29a9a40716d` | `fix/startak-re-umaps-official-source-20261122` | #815 | #767 | 23 |
| [#815](https://github.com/turkialeid2030/startak-real-estate/pull/815) | مسودة | `cebc32df416a` | `fix/startak-re-market-indication-sar-bounds-20261122` | #814 | #767 | 22 |
| [#814](https://github.com/turkialeid2030/startak-real-estate/pull/814) | مسودة | `8a9a3e2a0c7e` | `test/startak-re-legacy-57-manifest-gate-20261121` | #813 | #767 | 21 |
| [#813](https://github.com/turkialeid2030/startak-real-estate/pull/813) | مسودة | `98b4e44a1397` | `fix/startak-re-market-study-malformed-input-20261121` | #812 | #767 | 20 |
| [#812](https://github.com/turkialeid2030/startak-real-estate/pull/812) | مسودة | `f25ca81123e4` | `fix/startak-re-location-market-numeric-integrity-20261121` | #811 | #767 | 19 |
| [#811](https://github.com/turkialeid2030/startak-real-estate/pull/811) | مسودة | `22bd740d6d7a` | `fix/startak-re-valuation-reconciliation-arithmetic-20261121` | #810 | #767 | 18 |
| [#810](https://github.com/turkialeid2030/startak-real-estate/pull/810) | مسودة | `f3d96bcec5b5` | `fix/startak-re-appraisal-identity-type-guard-20261121` | #809 | #767 | 17 |
| [#809](https://github.com/turkialeid2030/startak-real-estate/pull/809) | مسودة | `99b537f89c55` | `fix/startak-re-replacement-cost-input-bounds-20261121` | #808 | #767 | 16 |
| [#808](https://github.com/turkialeid2030/startak-real-estate/pull/808) | مسودة | `dcc669fbc715` | `fix/startak-re-appraisal-review-link-validation-20261121` | #807 | #767 | 15 |
| [#807](https://github.com/turkialeid2030/startak-real-estate/pull/807) | مسودة | `71e0fba52ae7` | `fix/startak-re-title-mandatory-fact-floor-20261121` | #806 | #767 | 14 |
| [#806](https://github.com/turkialeid2030/startak-real-estate/pull/806) | مسودة | `749df7d6a9da` | `security/hardening-v1` | #803 | #767 | 13 |
| [#805](https://github.com/turkialeid2030/startak-real-estate/pull/805) | مسودة | `d55f187e63e6` | `security/hardening-v1` | #803 | #767 | 13 |
| [#803](https://github.com/turkialeid2030/startak-real-estate/pull/803) | مسودة | `6dc9821d25ac` | `fix/startak-re-title-fact-cross-source-integrity-20261114` | #802 | #767 | 12 |
| [#802](https://github.com/turkialeid2030/startak-real-estate/pull/802) | مسودة | `ef1bde52ee8e` | `audit/startak-re-legacy-functional-disposition-20261114` | #801 | #767 | 11 |
| [#801](https://github.com/turkialeid2030/startak-real-estate/pull/801) | مسودة | `b51b86988952` | `fix/startak-re-saved-deal-index-record-consistency-20261113` | #800 | #767 | 10 |
| [#800](https://github.com/turkialeid2030/startak-real-estate/pull/800) | مسودة | `ae0599b55773` | `fix/startak-re-sidecar-property-name-binding-20261113` | #799 | #767 | 9 |
| [#799](https://github.com/turkialeid2030/startak-real-estate/pull/799) | مسودة | `8e925d37d629` | `fix/startak-re-subject-scope-secondary-reports-20261113` | #798 | #767 | 8 |
| [#798](https://github.com/turkialeid2030/startak-real-estate/pull/798) | مسودة | `8fb3bb799c09` | `fix/startak-re-limited-interest-owner-indication-hold-20261113` | #797 | #767 | 7 |
| [#797](https://github.com/turkialeid2030/startak-real-estate/pull/797) | مسودة | `96d2b0ddd60c` | `feature/startak-re-sale-study-purpose-20261113` | #796 | #767 | 6 |
| [#796](https://github.com/turkialeid2030/startak-real-estate/pull/796) | مسودة | `3b1a804e3cb3` | `fix/startak-re-report-tenant-evidence-binding-20261113` | #795 | #767 | 5 |
| [#795](https://github.com/turkialeid2030/startak-real-estate/pull/795) | مسودة | `eb3d1c45ac2c` | `integration/personal-data-pipeline-20261110` | #777 | #767 | 4 |
| [#777](https://github.com/turkialeid2030/startak-real-estate/pull/777) | مسودة | `37aa63f8fe02` | `feature/formula-775-optional-indicators-20261109` | #776 | #767 | 3 |
| [#776](https://github.com/turkialeid2030/startak-real-estate/pull/776) | مسودة | `9ccc41fc77d1` | `feature/owner-five-step-wizard-staging-20261106` | #773 | #767 | 2 |
| [#773](https://github.com/turkialeid2030/startak-real-estate/pull/773) | مسودة | `5680c4ca676b` | `feature/appraisal-input-gaps-20261030` | #767 | #767 | 1 |
| [#772](https://github.com/turkialeid2030/startak-real-estate/pull/772) | مسودة | `54c7c74fdbcb` | `feature/appraisal-input-gaps-20261030` | #767 | #767 | 1 |
| [#767](https://github.com/turkialeid2030/startak-real-estate/pull/767) | مراجعة | `6527bab89877` | `main` | — | #767 | 0 |
| [#766](https://github.com/turkialeid2030/startak-real-estate/pull/766) | مسودة | `fa92a89c0cc0` | `feature/appraisal-assurance-p0-20261028` | #764 | #763 | 2 |
| [#764](https://github.com/turkialeid2030/startak-real-estate/pull/764) | مسودة | `f8eb90cd9e96` | `feature/location-market-valuation-20261027` | #763 | #763 | 1 |
| [#763](https://github.com/turkialeid2030/startak-real-estate/pull/763) | مراجعة | `802e27443a19` | `main` | — | #763 | 0 |
| [#655](https://github.com/turkialeid2030/startak-real-estate/pull/655) | مسودة | `8bc8ecf90f42` | `c73-5-quorum-root-trust-registry-20261009` | #654 | #463 | 90 |
| [#654](https://github.com/turkialeid2030/startak-real-estate/pull/654) | مسودة | `fd60dfb8998e` | `c73-4-cryptographic-external-readiness-evidence-20261008` | #653 | #463 | 89 |
| [#653](https://github.com/turkialeid2030/startak-real-estate/pull/653) | مسودة | `fc8988d9f43e` | `c73-3d-authenticated-restart-durable-witness-20261008` | #652 | #463 | 88 |
| [#652](https://github.com/turkialeid2030/startak-real-estate/pull/652) | مسودة | `9e654dbb0bdf` | `c73-3c-external-custody-witness-20261008` | #651 | #463 | 87 |
| [#651](https://github.com/turkialeid2030/startak-real-estate/pull/651) | مسودة | `4eaadb679751` | `c73-3b-encrypted-staging-evidence-vault-20261008` | #650 | #463 | 86 |
| [#650](https://github.com/turkialeid2030/startak-real-estate/pull/650) | مسودة | `7e4b4b5530d7` | `c73-3a-authenticated-http-custody-gate-20261008` | #649 | #463 | 85 |
| [#649](https://github.com/turkialeid2030/startak-real-estate/pull/649) | مسودة | `c58bda32ac74` | `c73-2-transactional-postgres-custody-20261008` | #647 | #463 | 84 |
| [#647](https://github.com/turkialeid2030/startak-real-estate/pull/647) | مسودة | `2bd08b1bd251` | `c73-stage1-signed-custody-integrity-20261008` | #646 | #463 | 83 |
| [#646](https://github.com/turkialeid2030/startak-real-estate/pull/646) | مسودة | `aa09eda620e4` | `c74-system-wide-real-browser-finance-adversarial-simulation-20261008` | #645 | #463 | 82 |
| [#645](https://github.com/turkialeid2030/startak-real-estate/pull/645) | مسودة | `36cdb6856af7` | `c72-real-browser-file-byte-sha256-specialist-20261008` | #643 | #463 | 81 |
| [#643](https://github.com/turkialeid2030/startak-real-estate/pull/643) | مسودة | `dce70f176c82` | `c71-specialist-c5-c6-report-hard-gate-browser-20261008` | #642 | #463 | 80 |
| [#642](https://github.com/turkialeid2030/startak-real-estate/pull/642) | مسودة | `d666415772bf` | `c70-live-specialist-evidence-intake-c61-gate-20261008` | #641 | #463 | 79 |
| [#641](https://github.com/turkialeid2030/startak-real-estate/pull/641) | مسودة | `a816c00ef232` | `c69-specialist-valuation-live-hold-browser-20261008` | #640 | #463 | 78 |
| [#640](https://github.com/turkialeid2030/startak-real-estate/pull/640) | مسودة | `49521c09aeb1` | `c68-native-bundled-react-hmr-e2e-20261008` | #639 | #463 | 77 |
| [#639](https://github.com/turkialeid2030/startak-real-estate/pull/639) | مسودة | `66844fd88567` | `c67-vite8-native-bundled-dev-chromium-20261008` | #638 | #463 | 76 |
| [#638](https://github.com/turkialeid2030/startak-real-estate/pull/638) | مسودة | `769a39bf2011` | `c66-vite-dev-commonjs-bootstrap-20261008` | #637 | #463 | 75 |
| [#637](https://github.com/turkialeid2030/startak-real-estate/pull/637) | مسودة | `8c3376057ac8` | `c64-land-development-live-chromium-20261008` | #636 | #463 | 74 |
| [#636](https://github.com/turkialeid2030/startak-real-estate/pull/636) | مسودة | `73c8fb67a9f3` | `c65-arabic-institutional-hold-disclosure-20261008` | #635 | #463 | 73 |
| [#635](https://github.com/turkialeid2030/startak-real-estate/pull/635) | مسودة | `b776363a5038` | `c63-chromium-valuation-live-e2e-20261008` | #631 | #463 | 72 |
| [#631](https://github.com/turkialeid2030/startak-real-estate/pull/631) | مسودة | `4e96577b52aa` | `c62-live-valuation-evidence-boundary-20261008` | #630 | #463 | 71 |
| [#630](https://github.com/turkialeid2030/startak-real-estate/pull/630) | مسودة | `c7205b7d39d1` | `c61-specialized-property-operating-hard-gates-20261008` | #629 | #463 | 70 |
| [#629](https://github.com/turkialeid2030/startak-real-estate/pull/629) | مسودة | `00d92d7399c4` | `c60-income-rate-evidence-20261008` | #627 | #463 | 69 |
| [#627](https://github.com/turkialeid2030/startak-real-estate/pull/627) | مسودة | `459ce31a5a44` | `c59-componentized-cost-obsolescence-20261008` | #626 | #463 | 68 |
| [#626](https://github.com/turkialeid2030/startak-real-estate/pull/626) | مسودة | `b18fbe9d6899` | `c58-comparable-provenance-chain-20261008` | #625 | #463 | 67 |
| [#625](https://github.com/turkialeid2030/startak-real-estate/pull/625) | مسودة | `d919ce207892` | `c57-sector-e2e-evidence-coverage-20261008` | #624 | #463 | 66 |
| [#624](https://github.com/turkialeid2030/startak-real-estate/pull/624) | مسودة | `5ae7e9b44ee7` | `c56-saudi-historical-validation-cohort-20261008` | #623 | #463 | 65 |
| [#623](https://github.com/turkialeid2030/startak-real-estate/pull/623) | مسودة | `9ab30b7b4ba4` | `c55-governed-dated-development-residual-20261008` | #617 | #463 | 64 |
| [#617](https://github.com/turkialeid2030/startak-real-estate/pull/617) | مسودة | `da4339593c0a` | `c54-market-comparable-decision-gate-20261008` | #613 | #463 | 63 |
| [#613](https://github.com/turkialeid2030/startak-real-estate/pull/613) | مسودة | `6b869107f19d` | `c53-private-alpha-source-acquisition-runtime` | #612 | #463 | 62 |
| [#612](https://github.com/turkialeid2030/startak-real-estate/pull/612) | مسودة | `890ce6bd9ab4` | `c52-private-alpha-governance-non-api-acquisition` | #611 | #463 | 61 |
| [#611](https://github.com/turkialeid2030/startak-real-estate/pull/611) | مسودة | `0b79c9dcca8d` | `c51-internal-historical-replay-readiness` | #609 | #463 | 60 |
| [#609](https://github.com/turkialeid2030/startak-real-estate/pull/609) | مسودة | `f5478b4155f3` | `c50-internal-human-uat-readiness` | #608 | #463 | 59 |
| [#608](https://github.com/turkialeid2030/startak-real-estate/pull/608) | مسودة | `f50e259c2a5c` | `c49-internal-official-source-data-rights-readiness` | #607 | #463 | 58 |
| [#607](https://github.com/turkialeid2030/startak-real-estate/pull/607) | مسودة | `352ecaf6c7a2` | `c48-internal-ai-provider-production-readiness` | #606 | #463 | 57 |
| [#606](https://github.com/turkialeid2030/startak-real-estate/pull/606) | مسودة | `e0d2cf2e92ca` | `c47-internal-privacy-pdpl-readiness` | #605 | #463 | 56 |
| [#605](https://github.com/turkialeid2030/startak-real-estate/pull/605) | مسودة | `e3dbbe193275` | `c46-internal-security-review-and-hardening` | #604 | #463 | 55 |
| [#604](https://github.com/turkialeid2030/startak-real-estate/pull/604) | مسودة | `65f1acd60335` | `c45-internal-source-rights-advisory-review` | #603 | #463 | 54 |
| [#603](https://github.com/turkialeid2030/startak-real-estate/pull/603) | مسودة | `4318c411a8dd` | `c44-current-source-rights-review-register` | #602 | #463 | 53 |
| [#602](https://github.com/turkialeid2030/startak-real-estate/pull/602) | مسودة | `560ab02b3164` | `c43-external-review-handoff-packets` | #601 | #463 | 52 |
| [#601](https://github.com/turkialeid2030/startak-real-estate/pull/601) | مسودة | `088792d841bd` | `c42-external-gate-closure-control` | #600 | #463 | 51 |
| [#600](https://github.com/turkialeid2030/startak-real-estate/pull/600) | مسودة | `db05999e5a3c` | `c39-historical-evidence-reuse-audit` | #597 | #463 | 50 |
| [#597](https://github.com/turkialeid2030/startak-real-estate/pull/597) | مسودة | `c09a3308ce1c` | `c38-rollback-signed-review-intake` | #595 | #463 | 49 |
| [#595](https://github.com/turkialeid2030/startak-real-estate/pull/595) | مسودة | `99c154ed5738` | `c37-rollback-independent-reviewer-designation` | #593 | #463 | 48 |
| [#593](https://github.com/turkialeid2030/startak-real-estate/pull/593) | مسودة | `299501bdcc5a` | `c36-rollback-evidence-review-handoff` | #591 | #463 | 47 |
| [#591](https://github.com/turkialeid2030/startak-real-estate/pull/591) | مسودة | `fe63dcc441cc` | `c35-owner-execution-wave1` | #589 | #463 | 46 |
| [#589](https://github.com/turkialeid2030/startak-real-estate/pull/589) | مسودة | `bc64c4556d74` | `c34-single-accountable-owner` | #569 | #463 | 45 |
| [#569](https://github.com/turkialeid2030/startak-real-estate/pull/569) | مسودة | `d1ef2ab26e73` | `c33-evidence-request-outreach-handoff` | #567 | #463 | 44 |
| [#567](https://github.com/turkialeid2030/startak-real-estate/pull/567) | مسودة | `03e6e37245bc` | `c32-evidence-acquisition-orchestration` | #565 | #463 | 43 |
| [#565](https://github.com/turkialeid2030/startak-real-estate/pull/565) | مسودة | `7d3f0cc65037` | `c31-canonical-evidence-readiness` | #557 | #463 | 42 |
| [#557](https://github.com/turkialeid2030/startak-real-estate/pull/557) | مسودة | `56c6c17ef6c9` | `c30-external-evidence-final-handoff` | #555 | #463 | 41 |
| [#555](https://github.com/turkialeid2030/startak-real-estate/pull/555) | مسودة | `5a69353d5361` | `c30-external-evidence-artifact-integrity` | #554 | #463 | 40 |
| [#554](https://github.com/turkialeid2030/startak-real-estate/pull/554) | مسودة | `03a9d2ccc6c6` | `c30-external-evidence-collection-pack` | #553 | #463 | 39 |
| [#553](https://github.com/turkialeid2030/startak-real-estate/pull/553) | مسودة | `b9a8381fe626` | `post-c30-vite-native-loader-compat` | #544 | #463 | 38 |
| [#544](https://github.com/turkialeid2030/startak-real-estate/pull/544) | مسودة | `2f066168f6cd` | `post-c30-browser-runtime-hardening` | #542 | #463 | 37 |
| [#542](https://github.com/turkialeid2030/startak-real-estate/pull/542) | مسودة | `ba617ef38784` | `c30-release-candidate-freeze-evidence-pack` | #539 | #463 | 36 |
| [#539](https://github.com/turkialeid2030/startak-real-estate/pull/539) | مسودة | `28013aa43de8` | `c29-integrated-case-review-ui-closure` | #538 | #463 | 35 |
| [#538](https://github.com/turkialeid2030/startak-real-estate/pull/538) | مسودة | `563fc735a44c` | `c29-governed-shadow-simulation-uat-harness` | #537 | #463 | 34 |
| [#537](https://github.com/turkialeid2030/startak-real-estate/pull/537) | مسودة | `90b4b12f6161` | `c28-comprehensive-integration-qualification` | #536 | #463 | 33 |
| [#536](https://github.com/turkialeid2030/startak-real-estate/pull/536) | مسودة | `c371c426cd10` | `c27-governed-observability-operational-safety` | #532 | #463 | 32 |
| [#532](https://github.com/turkialeid2030/startak-real-estate/pull/532) | مسودة | `39542e8b7029` | `c26-governed-operator-workspace-rbac` | #530 | #463 | 31 |
| [#530](https://github.com/turkialeid2030/startak-real-estate/pull/530) | مسودة | `2bbfbdb3c9df` | `c25-production-source-operational-readiness` | #527 | #463 | 30 |
| [#527](https://github.com/turkialeid2030/startak-real-estate/pull/527) | مسودة | `bb13a3f2e696` | `c24-integrated-case-property-orchestration` | #525 | #463 | 29 |
| [#525](https://github.com/turkialeid2030/startak-real-estate/pull/525) | مسودة | `99cf9fdb9f21` | `c23-governed-live-ai-provider-gateway` | #523 | #463 | 28 |
| [#523](https://github.com/turkialeid2030/startak-real-estate/pull/523) | مسودة | `a7ae9aab9ce4` | `c22-governed-generative-intelligence-orchestration` | #520 | #463 | 27 |
| [#520](https://github.com/turkialeid2030/startak-real-estate/pull/520) | مسودة | `dbc5b2ba6c2d` | `c21-governed-listing-transparency-amenity-utility` | #518 | #463 | 26 |
| [#518](https://github.com/turkialeid2030/startak-real-estate/pull/518) | مسودة | `611901065415` | `c20-governed-urban-growth-accessibility` | #516 | #463 | 25 |
| [#516](https://github.com/turkialeid2030/startak-real-estate/pull/516) | مسودة | `6bffb9564c46` | `c19-governed-policy-shock-comparable-impact` | #514 | #463 | 24 |
| [#514](https://github.com/turkialeid2030/startak-real-estate/pull/514) | مسودة | `5721333a319d` | `c18-governed-subdivision-merge-review` | #511 | #463 | 23 |
| [#511](https://github.com/turkialeid2030/startak-real-estate/pull/511) | مسودة | `35ceae211418` | `c17-governed-raw-land-strategic-optionality` | #509 | #463 | 22 |
| [#509](https://github.com/turkialeid2030/startak-real-estate/pull/509) | مسودة | `14a3e3efed86` | `c16-governed-auction-acquisition` | #507 | #463 | 21 |
| [#507](https://github.com/turkialeid2030/startak-real-estate/pull/507) | مسودة | `874829b26668` | `c2n-governed-non-api-source-acquisition` | #505 | #463 | 20 |
| [#505](https://github.com/turkialeid2030/startak-real-estate/pull/505) | مسودة | `82097194e2ad` | `c15-governed-rental-regulation` | #503 | #463 | 19 |
| [#503](https://github.com/turkialeid2030/startak-real-estate/pull/503) | مسودة | `422073b39361` | `c14-governed-financing-optimization` | #501 | #463 | 18 |
| [#501](https://github.com/turkialeid2030/startak-real-estate/pull/501) | مسودة | `d2852f8f6d2e` | `c13-governed-encumbrance-mortgage-closing` | #498 | #463 | 17 |
| [#498](https://github.com/turkialeid2030/startak-real-estate/pull/498) | مسودة | `4da183bcd326` | `c12-governed-regulatory-carry-cost` | #495 | #463 | 16 |
| [#495](https://github.com/turkialeid2030/startak-real-estate/pull/495) | مسودة | `c1b03f709b4c` | `c11-governed-income-asset-intelligence` | #493 | #463 | 15 |
| [#493](https://github.com/turkialeid2030/startak-real-estate/pull/493) | مسودة | `c05509f8805d` | `c10-governed-market-interpretation-liquidity` | #491 | #463 | 14 |
| [#491](https://github.com/turkialeid2030/startak-real-estate/pull/491) | مسودة | `4c60bdd67590` | `c9-governed-urban-code-plot-feasibility` | #489 | #463 | 13 |
| [#489](https://github.com/turkialeid2030/startak-real-estate/pull/489) | مسودة | `bcc5ca110942` | `c8-governed-title-survey-property-evidence` | #487 | #463 | 12 |
| [#487](https://github.com/turkialeid2030/startak-real-estate/pull/487) | مسودة | `639a96794ee5` | `c7-governed-correlated-monte-carlo` | #485 | #463 | 11 |
| [#485](https://github.com/turkialeid2030/startak-real-estate/pull/485) | مسودة | `a4f10e81366e` | `c6-browser-e2e-controlled-human-review` | #483 | #463 | 10 |
| [#483](https://github.com/turkialeid2030/startak-real-estate/pull/483) | مسودة | `9f234980efaa` | `c5-governed-decision-ui-export-integration` | #481 | #463 | 9 |
| [#481](https://github.com/turkialeid2030/startak-real-estate/pull/481) | مسودة | `c4dbc6e65b7f` | `c4-governed-deal-decision-report-integration` | #479 | #463 | 8 |
| [#479](https://github.com/turkialeid2030/startak-real-estate/pull/479) | مسودة | `7d284563907b` | `c3i-c2s-governed-reconciliation-integration` | #477 | #463 | 7 |
| [#477](https://github.com/turkialeid2030/startak-real-estate/pull/477) | مسودة | `e0bf23d45ffc` | `c2s-source-intelligence-evidence-provenance-registry` | #476 | #463 | 6 |
| [#476](https://github.com/turkialeid2030/startak-real-estate/pull/476) | مسودة | `0d098e907ea1` | `c3m-whole-property-market-sales-comparison-foundation` | #473 | #463 | 5 |
| [#473](https://github.com/turkialeid2030/startak-real-estate/pull/473) | مسودة | `bb8527db106c` | `c3-governed-valuation-reconciliation-foundation` | #471 | #463 | 4 |
| [#471](https://github.com/turkialeid2030/startak-real-estate/pull/471) | مسودة | `6dfbe797000e` | `c2-official-market-evidence-comparables-foundation` | #469 | #463 | 3 |
| [#469](https://github.com/turkialeid2030/startak-real-estate/pull/469) | مسودة | `a5c633dc0d53` | `c1-official-geospatial-evidence-foundation` | #466 | #463 | 2 |
| [#466](https://github.com/turkialeid2030/startak-real-estate/pull/466) | مسودة | `1fe99736c724` | `p27-current-model-reference-corpus-governance` | #463 | #463 | 1 |
| [#463](https://github.com/turkialeid2030/startak-real-estate/pull/463) | مراجعة | `b27b3d33320e` | `p26-financial-timing-basis-disclosure` | — | #463 | 0 |
| [#461](https://github.com/turkialeid2030/startak-real-estate/pull/461) | مراجعة | `73e6f04b6110` | `main` | — | #461 | 0 |

## شروط التسوية
1. مراجعة فروق العقود والسلوك والاختبارات بين كل طلب وابنه وسلسلة الأسلاف، مع منع التطابق الشكلي للملفات من احتساب تكافؤ وظيفي.
2. إصلاح أي تعارض في #461/#772 باستراتيجية منفصلة، دون حذف أعمال قديمة أو الإغراق في cherry-pick جماعي.
3. لا دمج إلا بعد نجاح CI على التزام الهدف، ومطابقة الماليات والحفظ والتقارير والمنهجية، ثم الرجوع للجهة صاحبة صلاحية النشر.
4. بعد أي دمج أو تعديل في قواعد PR، أعد توليد هذا التعداد. لا يُعد وصول العدد إلى صفر معيارًا مستقلًا لجودة الإنتاج.
