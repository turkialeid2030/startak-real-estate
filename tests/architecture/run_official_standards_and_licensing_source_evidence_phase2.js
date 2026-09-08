'use strict';

const assert = require('assert');
const evidence = require('../../governance/official-standards-and-licensing-source-evidence-phase2-2026-09-08.json');

let checks = 0;
function check(fn) { fn(); checks += 1; }

check(() => assert.strictEqual(evidence.evidenceRegisterId, 'STARTAK-OFFICIAL-STANDARDS-LICENSING-SOURCE-EVIDENCE-PHASE2-2026-09-08'));
check(() => assert.strictEqual(evidence.operatingMode, 'UNLICENSED_DECISION_SUPPORT'));
check(() => assert.strictEqual(evidence.overallStatus, 'PRIMARY_SOURCES_VERIFIED_PHASE_2_WITH_OPEN_APPLICABILITY_AND_EXTERNAL_AUTHORITY_REVIEW'));
check(() => assert.strictEqual(evidence.officialSourceVerificationBlockerClosed, false));
check(() => assert.strictEqual(evidence.standardsActivationAuthorized, false));
check(() => assert.strictEqual(evidence.professionalLicensingEstablished, false));
check(() => assert.strictEqual(evidence.professionalLegalReviewRequired, true));
check(() => assert.strictEqual(evidence.taqeemIvsCatalogAmbiguityResolvedForCanonicalTextIdentification, true));
check(() => assert.strictEqual(Array.isArray(evidence.records), true));
check(() => assert.strictEqual(evidence.records.length, 10));
check(() => assert.strictEqual(evidence.records.every((record) => record.sourceVerified === true), true));
check(() => assert.strictEqual(evidence.records.every((record) => record.activationAuthorized === false), true));
check(() => assert.strictEqual(evidence.records.every((record) => record.registryRecommendation === 'UNDER_REVIEW'), true));
check(() => assert.strictEqual(evidence.records.every((record) => /^https:\/\//.test(record.sourceUrl)), true));
check(() => assert.strictEqual(evidence.records.every((record) => record.sourceObservedDate === '2026-09-08'), true));

const byId = new Map(evidence.records.map((record) => [record.recordId, record]));
const taqeemIvs = byId.get('TAQEEM-IVS-2025-CANONICAL-DIRECT-ATTACHMENT');
const ipmsc = byId.get('IPMSC-IPMS-ALL-BUILDINGS-CURRENT');
const ricsIpms = byId.get('RICS-IPMS-ALL-BUILDINGS-2023');
const icmsc = byId.get('ICMSC-ICMS3-CURRENT');
const ricsIcms = byId.get('RICS-ICMS3-PUBLICATION');
const aiSpp = byId.get('APPRAISAL-INSTITUTE-STANDARDS-OF-PROFESSIONAL-PRACTICE-CURRENT');
const aiSvp = byId.get('APPRAISAL-INSTITUTE-SVP-EFFECTIVE-2021-11-12');
const taqeemLicense = byId.get('TAQEEM-PROFESSIONAL-LICENSE-ISSUANCE-CURRENT');
const taqeemFellowship = byId.get('TAQEEM-FELLOWSHIP-POLICY-UPDATE-2026-08-06');
const taqeemRules = byId.get('TAQEEM-RULES-LIBRARY-CURRENT-2026-08-03');

[taqeemIvs, ipmsc, ricsIpms, icmsc, ricsIcms, aiSpp, aiSvp, taqeemLicense, taqeemFellowship, taqeemRules]
  .forEach((record) => check(() => assert.ok(record)));

check(() => assert.strictEqual(taqeemIvs.sourceUrl.includes('taqeem.gov.sa'), true));
check(() => assert.strictEqual(taqeemIvs.observedFacts.documentStatesEffectiveDate, '2025-01-31'));
check(() => assert.strictEqual(taqeemIvs.observedFacts.directTaqeemHostedDocument, true));
check(() => assert.strictEqual(taqeemIvs.observedFacts.canonicalTextIdentified, true));
check(() => assert.strictEqual(taqeemIvs.observedFacts.digitalLibraryVisibleLabelStillSays2022, true));
check(() => assert.strictEqual(taqeemIvs.observedFacts.catalogMetadataMismatchPersists, true));

check(() => assert.strictEqual(ipmsc.sourceUrl.startsWith('https://ipmsc.org/'), true));
check(() => assert.strictEqual(ipmsc.observedFacts.currentStandardName, 'IPMS All Buildings'));
check(() => assert.strictEqual(ipmsc.observedFacts.globalMeasurementStandard, true));
check(() => assert.strictEqual(ipmsc.observedFacts.coalitionOrganizationsCount, 88));
check(() => assert.strictEqual(ipmsc.observedFacts.openSourceStandard, true));

check(() => assert.strictEqual(ricsIpms.sourceUrl.includes('rics.org'), true));
check(() => assert.strictEqual(ricsIpms.observedFacts.publishedDate, '2023-01-12'));
check(() => assert.strictEqual(ricsIpms.observedFacts.coversIndustrialOfficeResidentialRetail, true));

check(() => assert.strictEqual(icmsc.sourceUrl.startsWith('https://icms-coalition.org/'), true));
check(() => assert.strictEqual(icmsc.observedFacts.currentStandard, 'ICMS 3'));
check(() => assert.strictEqual(icmsc.observedFacts.thirdEditionDevelopedYear, 2021));
check(() => assert.strictEqual(icmsc.observedFacts.commonReportingFrameworkForCostAndCarbon, true));
check(() => assert.strictEqual(icmsc.observedFacts.lifeCycleCostCoverage, true));

check(() => assert.strictEqual(ricsIcms.sourceUrl.includes('rics.org'), true));
check(() => assert.strictEqual(ricsIcms.observedFacts.standard, 'ICMS 3'));
check(() => assert.strictEqual(ricsIcms.observedFacts.downloadPublishedDate, '2022-06-01'));
check(() => assert.strictEqual(ricsIcms.observedFacts.thirdEditionAddsCarbonEmissionsFramework, true));

check(() => assert.strictEqual(aiSpp.sourceUrl.includes('appraisalinstitute.org'), true));
check(() => assert.strictEqual(aiSpp.observedFacts.sppIncludesSvpAndCertificationStandardOrApplicableNationalInternationalStandards, true));
check(() => assert.strictEqual(aiSpp.observedFacts.svpMayBeUsedWhereOtherValuationStandardsAreNotRequiredOrDoNotApply, true));
check(() => assert.strictEqual(aiSpp.observedFacts.svpStandardADevelopment, true));
check(() => assert.strictEqual(aiSpp.observedFacts.svpStandardBReview, true));
check(() => assert.strictEqual(aiSpp.observedFacts.svpStandardCReporting, true));

check(() => assert.strictEqual(aiSvp.observedFacts.effectiveDate, '2021-11-12'));
check(() => assert.strictEqual(aiSvp.observedFacts.ethicalAndCompetentPracticeRequirements, true));

check(() => assert.strictEqual(taqeemLicense.sourceUrl.includes('taqeem.gov.sa'), true));
check(() => assert.strictEqual(taqeemLicense.observedFacts.activeBasicMembershipRequired, true));
check(() => assert.strictEqual(taqeemLicense.observedFacts.registrationInProfessionalRegisterRequired, true));
check(() => assert.strictEqual(taqeemLicense.observedFacts.licenseFeeRequired, true));
check(() => assert.strictEqual(taqeemLicense.observedFacts.licenseIsBranchSpecific, true));

check(() => assert.strictEqual(taqeemFellowship.observedFacts.policyUpdateDate, '2026-08-06'));
check(() => assert.strictEqual(taqeemFellowship.observedFacts.updatedPracticalExperienceRequirements, true));
check(() => assert.strictEqual(taqeemFellowship.observedFacts.membershipsObtainedOnOrAfter2026_06_29SubjectToUpdatedPolicy, true));

check(() => assert.strictEqual(taqeemRules.observedFacts.pageLastModifiedDate, '2026-08-03'));
check(() => assert.strictEqual(taqeemRules.observedFacts.listsExecutiveRegulationOfAccreditedValuersLaw, true));
check(() => assert.strictEqual(taqeemRules.observedFacts.listsProfessionalConductAndEthicsRules, true));
check(() => assert.strictEqual(taqeemRules.observedFacts.listsRulesForRealEstateValuationServicesToFinancingEntities, true));

check(() => assert.strictEqual(Array.isArray(evidence.verifiedConclusions), true));
check(() => assert.strictEqual(evidence.verifiedConclusions.length >= 6, true));
check(() => assert.strictEqual(Array.isArray(evidence.openIssues), true));
check(() => assert.strictEqual(evidence.openIssues.length >= 10, true));
check(() => assert.strictEqual(evidence.openIssues.some((item) => item.includes('digital-library metadata label')), true));
check(() => assert.strictEqual(evidence.openIssues.some((item) => item.includes('actual reviewer/valuer credentials')), true));
check(() => assert.strictEqual(evidence.openIssues.some((item) => item.includes('assignment-specific applicability of IPMS, ICMS')), true));
check(() => assert.strictEqual(evidence.openIssues.some((item) => item.includes('canonical-source hash comparison')), true));
check(() => assert.strictEqual(evidence.openIssues.some((item) => item.includes('Do not set formalStandardsConformanceEstablished')), true));

// Source verification cannot create production, professional or transaction authority.
const serialized = JSON.stringify(evidence);
check(() => assert.strictEqual(serialized.includes('"registryRecommendation":"ACTIVE"'), false));
check(() => assert.strictEqual(serialized.includes('"activationAuthorized":true'), false));
check(() => assert.strictEqual(serialized.includes('"officialSourceVerificationBlockerClosed":true'), false));
check(() => assert.strictEqual(serialized.includes('"professionalLicensingEstablished":true'), false));

console.log(`OFFICIAL_STANDARDS_LICENSING_SOURCE_EVIDENCE_PHASE2=PASS checks=${checks}`);
