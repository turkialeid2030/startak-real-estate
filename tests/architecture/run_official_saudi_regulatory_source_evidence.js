'use strict';

const assert = require('assert');
const evidence = require('../../governance/official-saudi-regulatory-source-evidence-2026-09-08.json');

let checks = 0;
function check(fn) { fn(); checks += 1; }

check(() => assert.strictEqual(evidence.evidenceRegisterId, 'STARTAK-OFFICIAL-SAUDI-REGULATORY-SOURCE-EVIDENCE-2026-09-08'));
check(() => assert.strictEqual(evidence.operatingMode, 'UNLICENSED_DECISION_SUPPORT'));
check(() => assert.strictEqual(evidence.overallStatus, 'PRIMARY_SAUDI_REGULATORY_SOURCES_VERIFIED_PHASE_1_WITH_OPEN_APPLICABILITY_REVIEW'));
check(() => assert.strictEqual(evidence.officialRegulatorySourceVerificationBlockerClosed, false));
check(() => assert.strictEqual(evidence.regulatoryActivationAuthorized, false));
check(() => assert.strictEqual(evidence.professionalLegalReviewRequired, true));
check(() => assert.strictEqual(Array.isArray(evidence.records), true));
check(() => assert.strictEqual(evidence.records.length, 10));
check(() => assert.strictEqual(evidence.records.every((record) => record.sourceVerified === true), true));
check(() => assert.strictEqual(evidence.records.every((record) => record.activationAuthorized === false), true));
check(() => assert.strictEqual(evidence.records.every((record) => record.registryRecommendation === 'UNDER_REVIEW'), true));
check(() => assert.strictEqual(evidence.records.every((record) => /^https:\/\//.test(record.sourceUrl)), true));
check(() => assert.strictEqual(evidence.records.every((record) => record.sourceObservedDate === '2026-09-08'), true));

const byId = new Map(evidence.records.map((record) => [record.recordId, record]));
const regaLaw = byId.get('REGA-REAL-ESTATE-BROKERAGE-LAW-ACTIVE');
const regaRegs = byId.get('REGA-BROKERAGE-IMPLEMENTING-REGULATIONS-ACTIVE');
const cma = byId.get('CMA-REAL-ESTATE-INVESTMENT-FUNDS-VALUATION-2025');
const rettLaw = byId.get('ZATCA-RETT-LAW-EFFECTIVE-2025-04-10');
const rettRules = byId.get('ZATCA-RETT-EXECUTIVE-RULES-CURRENT-PAGE');
const socpa = byId.get('SOCPA-INTERNATIONAL-STANDARDS-ENDORSEMENT-2026');
const socpaSmes = byId.get('SOCPA-IFRS-FOR-SMES-2025-FUTURE-EFFECTIVE');
const pdpl = byId.get('SDAIA-PDPL-LAW-CURRENT');
const pdplRegs = byId.get('SDAIA-PDPL-EXECUTIVE-REGULATIONS-CURRENT');
const sama = byId.get('SAMA-REAL-ESTATE-FINANCE-LAW-IN-FORCE');

[regaLaw, regaRegs, cma, rettLaw, rettRules, socpa, socpaSmes, pdpl, pdplRegs, sama]
  .forEach((record) => check(() => assert.ok(record)));

check(() => assert.strictEqual(regaLaw.sourceUrl.startsWith('https://rega.gov.sa/'), true));
check(() => assert.strictEqual(regaLaw.observedFacts.status, 'Active'));
check(() => assert.strictEqual(regaLaw.observedFacts.regulatesRealEstateBrokerageAndServices, true));
check(() => assert.strictEqual(regaLaw.observedFacts.licenseRequiredForCoveredBrokerageOrServices, true));
check(() => assert.strictEqual(regaLaw.reviewNotes.includes('does not conclude'), true));

check(() => assert.strictEqual(regaRegs.observedFacts.status, 'Active'));
check(() => assert.strictEqual(regaRegs.observedFacts.conflictDisclosureRequirementsPresent, true));
check(() => assert.strictEqual(regaRegs.observedFacts.materialPropertyInformationDisclosureRequirementsPresent, true));

check(() => assert.strictEqual(cma.sourceUrl.includes('cma.org.sa'), true));
check(() => assert.strictEqual(cma.observedFacts.article36ValuationRequirementsObserved, true));
check(() => assert.strictEqual(cma.observedFacts.twoAccreditedValuersRequiredForPurchaseOrSale, true));
check(() => assert.strictEqual(cma.observedFacts.valuerIndependenceRequired, true));
check(() => assert.strictEqual(cma.observedFacts.taqeemFellowshipRequired, true));
check(() => assert.strictEqual(cma.observedFacts.purchaseSaleValuationAgeLimitMonths, 3));

check(() => assert.strictEqual(rettLaw.sourceUrl.includes('zatca.gov.sa'), true));
check(() => assert.strictEqual(rettLaw.observedFacts.taxRatePercent, 5));
check(() => assert.strictEqual(rettLaw.observedFacts.lawEffectiveDate, '2025-04-10'));
check(() => assert.strictEqual(rettRules.observedFacts.reitRatePercentDisplayed, 5));
check(() => assert.strictEqual(rettRules.observedFacts.updatedExecutiveRulesLinkProvided, true));

check(() => assert.strictEqual(socpa.sourceUrl.includes('socpa.org.sa'), true));
check(() => assert.strictEqual(socpa.observedFacts.internationalAccountingStandardsEndorsementDocumentProvided, true));
check(() => assert.strictEqual(socpa.observedFacts.internationalAuditingStandardsEndorsementDocumentProvided, true));
check(() => assert.strictEqual(socpaSmes.observedFacts.futureEffectiveForAnnualPeriodsBeginningOnOrAfter, '2027-01-01'));
check(() => assert.strictEqual(socpaSmes.observedFacts.earlyApplicationPermitted, true));
check(() => assert.strictEqual(socpaSmes.observedFacts.saudiEndorsementMayContainModificationsOrAdditionalRequirements, true));

check(() => assert.strictEqual(pdpl.sourceUrl.includes('sdaia.gov.sa'), true));
check(() => assert.strictEqual(pdpl.observedFacts.royalDecree, 'M/19'));
check(() => assert.strictEqual(pdpl.observedFacts.personalDataDefinitionIncludesDirectAndIndirectIdentification, true));
check(() => assert.strictEqual(pdplRegs.observedFacts.lawAmendmentRoyalDecree, 'M/148'));
check(() => assert.strictEqual(pdplRegs.observedFacts.executiveRegulationsVerifiedOnOfficialPlatform, true));

check(() => assert.strictEqual(sama.sourceUrl.includes('sama.gov.sa'), true));
check(() => assert.strictEqual(sama.observedFacts.articleStatus, 'In-Force'));
check(() => assert.strictEqual(sama.observedFacts.samaRegulatesRealEstateFinanceSector, true));
check(() => assert.strictEqual(sama.observedFacts.samaIssuesRealEstateFinanceStandardsAndProcedures, true));

check(() => assert.strictEqual(Array.isArray(evidence.verifiedConclusions), true));
check(() => assert.strictEqual(evidence.verifiedConclusions.length >= 6, true));
check(() => assert.strictEqual(Array.isArray(evidence.openIssues), true));
check(() => assert.strictEqual(evidence.openIssues.length >= 8, true));
check(() => assert.strictEqual(evidence.openIssues.some((item) => item.includes('REGA licensing')), true));
check(() => assert.strictEqual(evidence.openIssues.some((item) => item.includes('PDPL data inventory')), true));
check(() => assert.strictEqual(evidence.openIssues.some((item) => item.includes('IPMS, ICMS')), true));
check(() => assert.strictEqual(evidence.openIssues.some((item) => item.includes('Do not convert any source-evidence record to ACTIVE')), true));

// Evidence-only phase must not silently create regulatory or production authority.
check(() => assert.strictEqual(JSON.stringify(evidence).includes('"registryRecommendation":"ACTIVE"'), false));
check(() => assert.strictEqual(JSON.stringify(evidence).includes('"activationAuthorized":true'), false));
check(() => assert.strictEqual(JSON.stringify(evidence).includes('"officialRegulatorySourceVerificationBlockerClosed":true'), false));

console.log(`OFFICIAL_SAUDI_REGULATORY_SOURCE_EVIDENCE=PASS checks=${checks}`);
