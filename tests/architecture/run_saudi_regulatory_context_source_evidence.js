'use strict';

const assert = require('assert');
const evidence = require('../../governance/saudi-regulatory-context-source-evidence-2026-09-08.json');

let checks = 0;
function check(fn) { fn(); checks += 1; }

check(() => assert.strictEqual(evidence.evidenceRegisterId, 'STARTAK-SAUDI-REGULATORY-CONTEXT-SOURCE-EVIDENCE-2026-09-08'));
check(() => assert.strictEqual(evidence.operatingMode, 'UNLICENSED_DECISION_SUPPORT'));
check(() => assert.strictEqual(evidence.overallStatus, 'PRIMARY_SAUDI_CONTEXT_SOURCES_VERIFIED_WITH_PURPOSE_SPECIFIC_APPLICABILITY_REVIEW_REQUIRED'));
[
  'saudiLegalReviewComplete', 'pdplComplianceEstablished', 'taxComplianceEstablished',
  'financialReportingComplianceEstablished', 'regulatedContextActivationAuthorized',
].forEach((field) => check(() => assert.strictEqual(evidence[field], false, `${field} must remain false`)));

check(() => assert.strictEqual(Array.isArray(evidence.records), true));
check(() => assert.strictEqual(evidence.records.length, 11));
check(() => assert.strictEqual(new Set(evidence.records.map((record) => record.recordId)).size, evidence.records.length));
check(() => assert.strictEqual(evidence.records.every((record) => record.sourceVerified === true), true));
check(() => assert.strictEqual(evidence.records.every((record) => record.productionRuleRecommendation === 'UNDER_REVIEW'), true));
check(() => assert.strictEqual(evidence.records.every((record) => typeof record.applicability === 'string' && record.applicability.length > 0), true));
check(() => assert.strictEqual(evidence.records.every((record) => /^https:\/\//.test(record.sourceUrl)), true));
check(() => assert.strictEqual(evidence.records.every((record) => record.sourceObservedDate === '2026-09-08'), true));

const byId = new Map(evidence.records.map((record) => [record.recordId, record]));
const taqeem = byId.get('TAQEEM-RULES-CURRENT-2026-08-03');
const reportQa = byId.get('TAQEEM-REAL-ESTATE-REPORT-QUALITY-MODEL-2026-04-01');
const rega = byId.get('REGA-REAL-ESTATE-CONTRIBUTIONS-VALUATION-RULE');
const cma = byId.get('CMA-REAL-ESTATE-INVESTMENT-FUNDS-VALUATION-2025');
const samaValuation = byId.get('SAMA-REAL-ESTATE-VALUATION-CLIENT-OBLIGATIONS');
const samaCollateral = byId.get('SAMA-COLLATERAL-VALUATION-2026-01-11');
const socpa = byId.get('SOCPA-IFRS13-FAIR-VALUE-2025');
const pdpl = byId.get('SDAIA-PDPL-CURRENT');
const transfer = byId.get('SDAIA-PDPL-CROSS-BORDER-TRANSFER-REGULATION');
const rettLaw = byId.get('ZATCA-RETT-LAW-2025-CURRENT-2026');
const rettReg = byId.get('ZATCA-RETT-EXECUTIVE-REGULATION-2025-CURRENT');
[taqeem, reportQa, rega, cma, samaValuation, samaCollateral, socpa, pdpl, transfer, rettLaw, rettReg].forEach((record) => check(() => assert.ok(record)));

check(() => assert.strictEqual(taqeem.sourceUrl.includes('taqeem.gov.sa'), true));
check(() => assert.strictEqual(taqeem.observedFacts.pageLastModifiedSaudiDate, '2026-08-03'));
check(() => assert.strictEqual(taqeem.observedFacts.listsAccreditedValuersExecutiveRegulations, true));
check(() => assert.strictEqual(taqeem.observedFacts.listsValuationProfessionEthicsRules, true));
check(() => assert.strictEqual(taqeem.observedFacts.listsRealEstateValuationServicesForFinancingEntitiesRules, true));

check(() => assert.strictEqual(reportQa.observedFacts.publicationDate, '2026-04-01'));
check(() => assert.strictEqual(reportQa.observedFacts.realEstateReportQualityModelLaunched, true));
check(() => assert.strictEqual(reportQa.applicability, 'REPORT_QA_CONTEXT'));

check(() => assert.strictEqual(rega.sourceUrl.includes('rega.gov.sa'), true));
check(() => assert.strictEqual(rega.applicability, 'REAL_ESTATE_CONTRIBUTIONS_ONLY'));
check(() => assert.strictEqual(rega.observedFacts.authorityUsesAverageBetweenAccreditedValuationReportsInThisContext, true));
check(() => assert.strictEqual(rega.observedFacts.valuationOutsideOtherTwoByMoreThanTenPercentIsExcludedAndReplaced, true));
check(() => assert.strictEqual(rega.reviewNotes.includes('must never be generalized'), true));

check(() => assert.strictEqual(cma.sourceUrl.includes('cma.org.sa'), true));
check(() => assert.strictEqual(cma.applicability, 'CMA_REAL_ESTATE_FUND_CONTEXT_ONLY'));
check(() => assert.strictEqual(cma.observedFacts.accreditedValuerFellowshipRequired, true));
check(() => assert.strictEqual(cma.observedFacts.purchaseSaleValuationReportMaximumAgeMonths, 3));
check(() => assert.strictEqual(cma.observedFacts.publicOfferingRequiresTwoAccreditedValuationReportsWhereApplicable, true));
check(() => assert.strictEqual(cma.observedFacts.marketRentDisclosureRequiredWhenDifferentFromContractRentForIncomeProperty, true));

check(() => assert.strictEqual(samaValuation.sourceUrl.includes('sama.gov.sa'), true));
check(() => assert.strictEqual(samaValuation.observedFacts.rulebookStatus, 'ACTIVE'));
check(() => assert.strictEqual(samaValuation.applicability, 'SAMA_SUPERVISED_ENTITY_CONTEXT_ONLY'));
check(() => assert.strictEqual(samaValuation.observedFacts.supervisedEntitiesMustUseLicensedAccreditedRealEstateValuers, true));
check(() => assert.strictEqual(samaValuation.observedFacts.valuationGovernanceMustSeparateFinancingInsuranceFromValuationProcess, true));
check(() => assert.strictEqual(samaValuation.observedFacts.clientMustNotForceSpecificValuationMethods, true));

check(() => assert.strictEqual(samaCollateral.observedFacts.effectiveRuleDate, '2026-01-11'));
check(() => assert.strictEqual(samaCollateral.observedFacts.rulebookStatus, 'ACTIVE'));
check(() => assert.strictEqual(samaCollateral.observedFacts.collateralMustBeValuedAndLegalSoundnessCheckedBeforeFinancing, true));
check(() => assert.strictEqual(samaCollateral.observedFacts.marketSensitiveCollateralMustBePeriodicallyRevalued, true));

check(() => assert.strictEqual(socpa.sourceUrl.includes('socpa.org.sa'), true));
check(() => assert.strictEqual(socpa.observedFacts.standard, 'IFRS 13 Fair Value Measurement'));
check(() => assert.strictEqual(socpa.observedFacts.socpaAdoptedStandard, true));
check(() => assert.strictEqual(socpa.observedFacts.adoptedWithoutModification, true));
check(() => assert.strictEqual(socpa.applicability, 'FINANCIAL_REPORTING_PURPOSE_ONLY'));

check(() => assert.strictEqual(pdpl.sourceUrl.includes('sdaia.gov.sa'), true));
check(() => assert.strictEqual(pdpl.observedFacts.lawRoyalDecree, 'M/19 dated 09/02/1443H'));
check(() => assert.strictEqual(pdpl.observedFacts.crossBorderTransferConditionsExist, true));
check(() => assert.strictEqual(pdpl.observedFacts.minimumNecessaryDataPrincipleAppliesToTransfer, true));
check(() => assert.strictEqual(transfer.observedFacts.dedicatedCrossBorderTransferRegulationExists, true));
check(() => assert.strictEqual(transfer.observedFacts.appropriateSafeguardsConceptDefined, true));

check(() => assert.strictEqual(rettLaw.sourceUrl.includes('zatca.gov.sa'), true));
check(() => assert.strictEqual(rettLaw.observedFacts.rettRatePct, 5));
check(() => assert.strictEqual(rettLaw.observedFacts.currentLawRoyalDecree, 'M/84 dated 19/03/1446H'));
check(() => assert.strictEqual(rettLaw.observedFacts.lawEffectiveDateGregorian, '2025-04-10'));
check(() => assert.strictEqual(rettLaw.observedFacts.pageLastUpdated, '2026-08-31'));
check(() => assert.strictEqual(rettReg.observedFacts.boardDecision, '01-03-25'));
check(() => assert.strictEqual(rettReg.observedFacts.decisionDateGregorian, '2025-03-24'));
check(() => assert.strictEqual(rettReg.observedFacts.implementsCurrentRettLaw, true));

check(() => assert.strictEqual(Array.isArray(evidence.verifiedRoutingConclusions), true));
check(() => assert.strictEqual(evidence.verifiedRoutingConclusions.length >= 6, true));
check(() => assert.strictEqual(Array.isArray(evidence.openIssues), true));
check(() => assert.strictEqual(evidence.openIssues.length >= 7, true));
check(() => assert.strictEqual(evidence.openIssues.some((item) => item.includes('PDPL')), true));
check(() => assert.strictEqual(evidence.openIssues.some((item) => item.includes('ZATCA RETT')), true));
check(() => assert.strictEqual(evidence.openIssues.some((item) => item.includes('IPMS/ICMS')), true));
check(() => assert.strictEqual(evidence.openIssues.some((item) => item.includes('No context record may be marked ACTIVE')), true));

// A context-specific regulator status such as SAMA ACTIVE may be recorded as a source fact,
// but no STARTAK production recommendation can be ACTIVE in this evidence-only layer.
check(() => assert.strictEqual(evidence.records.some((record) => record.observedFacts.rulebookStatus === 'ACTIVE'), true));
check(() => assert.strictEqual(evidence.records.some((record) => record.productionRuleRecommendation === 'ACTIVE'), false));
check(() => assert.strictEqual(JSON.stringify(evidence).includes('"regulatedContextActivationAuthorized":true'), false));

console.log(`SAUDI_REGULATORY_CONTEXT_SOURCE_EVIDENCE=PASS checks=${checks}`);
