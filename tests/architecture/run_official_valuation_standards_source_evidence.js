'use strict';

const assert = require('assert');
const evidence = require('../../governance/official-valuation-standards-source-evidence-2026-09-08.json');

let checks = 0;
function check(fn) { fn(); checks += 1; }

check(() => assert.strictEqual(evidence.evidenceRegisterId, 'STARTAK-OFFICIAL-VALUATION-STANDARDS-SOURCE-EVIDENCE-2026-09-08'));
check(() => assert.strictEqual(evidence.operatingMode, 'UNLICENSED_DECISION_SUPPORT'));
check(() => assert.strictEqual(evidence.overallStatus, 'PRIMARY_SOURCES_VERIFIED_WITH_OPEN_APPLICABILITY_AND_CATALOG_REVIEW'));
check(() => assert.strictEqual(evidence.officialStandardsSourceVerificationBlockerClosed, false));
check(() => assert.strictEqual(evidence.standardsActivationAuthorized, false));
check(() => assert.strictEqual(evidence.professionalLegalReviewRequired, true));
check(() => assert.strictEqual(Array.isArray(evidence.records), true));
check(() => assert.strictEqual(evidence.records.length, 6));
check(() => assert.strictEqual(evidence.records.every((record) => record.sourceVerified === true), true));
check(() => assert.strictEqual(evidence.records.every((record) => record.activationAuthorized === false), true));
check(() => assert.strictEqual(evidence.records.every((record) => record.registryRecommendation === 'UNDER_REVIEW'), true));
check(() => assert.strictEqual(evidence.records.every((record) => /^https:\/\//.test(record.sourceUrl)), true));
check(() => assert.strictEqual(evidence.records.every((record) => record.sourceObservedDate === '2026-09-08'), true));

const byId = new Map(evidence.records.map((record) => [record.recordId, record]));
const ivs = byId.get('IVSC-IVS-2025-EFFECTIVE');
const ivsSaudi = byId.get('IVSC-SAUDI-IVS-ADOPTION');
const taqeemIvs = byId.get('TAQEEM-IVS-BASIS-CONCLUSIONS-2025');
const taqeemCatalog = byId.get('TAQEEM-DIGITAL-LIBRARY-2026-07-29');
const rics = byId.get('RICS-RED-BOOK-2025-EFFECTIVE');
const taqeemRics = byId.get('TAQEEM-RICS-ARABIC-2025');

[ivs, ivsSaudi, taqeemIvs, taqeemCatalog, rics, taqeemRics].forEach((record) => check(() => assert.ok(record)));
check(() => assert.strictEqual(ivs.sourceUrl.startsWith('https://ivsc.org/'), true));
check(() => assert.strictEqual(ivs.observedFacts.latestEditionPublishedDate, '2024-01-31'));
check(() => assert.strictEqual(ivs.observedFacts.effectiveDate, '2025-01-31'));
check(() => assert.strictEqual(ivs.observedFacts.effectiveForValuationsOnOrAfter, '2025-01-31'));
check(() => assert.strictEqual(ivs.observedFacts.historicalValuationRequiresEditionDocumentation, true));

check(() => assert.strictEqual(ivsSaudi.sourceUrl, 'https://ivsc.org/ivsc-mea/'));
check(() => assert.strictEqual(ivsSaudi.observedFacts.jurisdiction, 'Saudi Arabia'));
check(() => assert.strictEqual(ivsSaudi.observedFacts.taqeemDescribedAsStatutoryRegulator, true));
check(() => assert.strictEqual(ivsSaudi.observedFacts.ivscStatesTaqeemAdoptedIvsAsFoundation, true));
check(() => assert.strictEqual(ivsSaudi.observedFacts.ivscStatesLatestEditionEffectiveDate, '2025-01-31'));
check(() => assert.strictEqual(ivsSaudi.observedFacts.ivscStatesLatestEditionAdoptedInKingdom, true));

check(() => assert.strictEqual(taqeemIvs.sourceUrl.includes('taqeem.gov.sa'), true));
check(() => assert.strictEqual(taqeemIvs.observedFacts.documentReferencesIvsEffectiveDate, '2025-01-31'));
check(() => assert.strictEqual(taqeemIvs.observedFacts.taqeemBrandingPresent, true));
check(() => assert.strictEqual(taqeemIvs.observedFacts.ivscBrandingPresent, true));

check(() => assert.strictEqual(taqeemCatalog.observedFacts.pageLastModifiedSaudiDate, '2026-07-29'));
check(() => assert.strictEqual(taqeemCatalog.observedFacts.listsRicsGlobalValuationStandards2025, true));
check(() => assert.strictEqual(taqeemCatalog.observedFacts.listsInternationalValuationStandards2022, true));
check(() => assert.strictEqual(taqeemCatalog.catalogAmbiguityFlag, true));
check(() => assert.strictEqual(taqeemCatalog.reviewNotes.includes('discrepancy'), true));

check(() => assert.strictEqual(rics.sourceUrl.startsWith('https://www.rics.org/'), true));
check(() => assert.strictEqual(rics.observedFacts.currentEdition, 'RICS Valuation – Global Standards 2025'));
check(() => assert.strictEqual(rics.observedFacts.effectiveDate, '2025-01-31'));
check(() => assert.strictEqual(rics.observedFacts.incorporatesIvsEffective2025, true));

check(() => assert.strictEqual(taqeemRics.sourceUrl.includes('taqeem.gov.sa'), true));
check(() => assert.strictEqual(taqeemRics.observedFacts.effectiveDate, '2025-01-31'));
check(() => assert.strictEqual(taqeemRics.observedFacts.documentStatesNationalLegalRequirementsTakePriorityOnConflict, true));
check(() => assert.strictEqual(taqeemRics.observedFacts.documentStatesRicsOfficialArabicVersionIsFinalRegulatoryReferenceForRicsText, true));

check(() => assert.strictEqual(Array.isArray(evidence.verifiedConclusions), true));
check(() => assert.strictEqual(evidence.verifiedConclusions.length >= 5, true));
check(() => assert.strictEqual(Array.isArray(evidence.openIssues), true));
check(() => assert.strictEqual(evidence.openIssues.length >= 5, true));
check(() => assert.strictEqual(evidence.openIssues.some((item) => item.includes('catalog/version-label ambiguity')), true));
check(() => assert.strictEqual(evidence.openIssues.some((item) => item.includes('professional/legal review')), true));
check(() => assert.strictEqual(evidence.openIssues.some((item) => item.includes('Do not activate a standard solely')), true));
check(() => assert.strictEqual(evidence.openIssues.some((item) => item.includes('ESG guidance')), true));

// No record in this evidence-only phase may be silently activated.
check(() => assert.strictEqual(JSON.stringify(evidence).includes('"registryRecommendation":"ACTIVE"'), false));
check(() => assert.strictEqual(JSON.stringify(evidence).includes('"activationAuthorized":true'), false));

console.log(`OFFICIAL_VALUATION_STANDARDS_SOURCE_EVIDENCE=PASS checks=${checks}`);
