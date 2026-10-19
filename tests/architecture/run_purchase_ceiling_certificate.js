'use strict';
const assert = require('node:assert/strict');
const { calculateUiInvestmentState } = require('../../src/assumptions/ui-integration-controller');
const { certifyPurchaseCeiling, purchaseCeilingCertificateMessage } = require('../../src/assumptions/purchase-ceiling-certificate');
const { qualifyPurchaseBoundary } = require('../../src/assumptions/purchase-boundary-qualification');
const { calculateInvestmentCase, STUDY_TYPE } = require('../../src/engines');
const { buildPersonalFinancialStudy, verifyPersonalFinancialStudy, htmlFinancialStudy } = require('../../src/app/personal-financial-study');
const gold = require('../reference/RE-GOLD-baseline.json')['RE-GOLD-002_existing_building'].inputs;
const base = { ...gold, leaseYears: 10, exitCapRate: .075, exitTransferFeeRate: 0 };
const state = (inputs, version = 'LEGACY') => calculateUiInvestmentState({ mode: 'building', inputs, assumptionModelVersion: version }).results;
let checks = 0;
const ok = (value, message) => { assert.ok(value, message); checks++; };
const eq = (a, b, message) => { assert.deepEqual(a, b, message); checks++; };

// Independent decimal/rational oracle: no production precision helpers.
function scaled(value, digits) {
  const text = String(value), negative = text.startsWith('-');
  const [whole, fraction = ''] = text.replace(/^-/, '').split('.');
  let units = BigInt(whole) * 10n ** BigInt(digits) + BigInt(fraction.slice(0, digits).padEnd(digits, '0') || '0');
  if (Number(fraction[digits] || 0) >= 5) units++;
  return negative ? -units : units;
}
function roundedRatio(n, d) {
  const negative = n < 0n; if (negative) n = -n;
  const units = n / d + (2n * (n % d) >= d ? 1n : 0n);
  return negative ? -units : units;
}
function futurePvMinor(rate, flows) {
  const scale = 10n ** 12n, base = scale + scaled(rate, 12);
  let numerator = 1n, denominator = 1n, pv = 0n;
  for (const flow of flows) {
    numerator *= scale; denominator *= base;
    pv += roundedRatio(scaled(flow, 2) * numerator, denominator);
  }
  return pv;
}
for (const version of ['LEGACY', 'V2']) for (const leverageEnabled of [false, true]) {
  for (const [changes, expectedGate] of [
    [{ discountRate: .08 }, 'CUMULATIVE_PAYBACK'],
    [{ discountRate: version === 'V2' ? .15 : .5 }, 'NPV_NON_NEGATIVE'],
    [{ minYieldThreshold: .5 }, 'NET_YIELD_ON_COST'],
    [{ marketCapRate: .4 }, 'INCOME_VALUE_COVERS_COST'],
  ]) {
    const inputs = { ...base, leverageEnabled, ...changes }, result = state(inputs, version), c = result.purchaseCeilingCertificate;
    eq(c.status, 'PROVEN_WITHIN_MODEL'); ok(c.maximumProvenWithinModel); ok(c.blockingCriteria.includes(expectedGate));
    eq(c.transactionAuthorized, false); eq(c.sourceIndependentlyVerified, false); eq(c.scope.priceStepSar, .01);
    eq(c.qualification.criteria.length, leverageEnabled ? 8 : 6);
    ok(c.qualification.criteria.every(x => x.met === true));
    eq(c.nextPrice, (Math.round(c.price * 100) + 1) / 100);
    const next = qualifyPurchaseBoundary(inputs, version, c.nextPrice);
    eq(next.qualifiedPrice, null); ok(c.blockingCriteria.every(code => next.failedCriteria.includes(code)));
    eq(BigInt(c.proof.futurePresentValueMinor), futurePvMinor(inputs.discountRate, c.proof.futureUnleveredCashflows));
    eq(BigInt(c.proof.nextNpvMinor), BigInt(c.proof.futurePresentValueMinor) - BigInt(c.proof.nextAcquisitionCostMinor));
    eq(result.purchaseAlternative.globalMaximumEstablished, false, 'point-search contract is not silently promoted into a proof');
    // Stress the documented exclusion; not used as a substitute for its proof.
    for (const higher of [c.nextPrice, c.nextPrice + 1, c.nextPrice + 1000, c.price * 1.5]) {
      eq(qualifyPurchaseBoundary(inputs, version, higher).qualifiedPrice, null);
    }
    const changedPrice = calculateInvestmentCase({ studyType: STUDY_TYPE.EXISTING_BUILDING,
      inputs: { ...inputs, buildingPrice: c.price * 1.1 }, assumptionModelVersion: version });
    eq(changedPrice.cashflows.slice(1), c.proof.futureUnleveredCashflows);
    eq(changedPrice.paybackNoiCashflows, c.proof.paybackOperatingCashflows);
  }
}
const complete = state(base).purchaseCeilingCertificate;
for (const changes of [{ leverageEnabled: false, ltv: 0 }, { leverageEnabled: true, ltv: 0 }]) {
  eq(state({ ...base, ...changes }).purchaseCeilingCertificate.price, complete.price);
}
const debtLimited = state({ ...base, leverageEnabled: true, equityRiskSpread: .5 });
ok(debtLimited.purchaseAlternative.price > 0);
eq(debtLimited.purchaseCeilingCertificate.status, 'NOT_PROVEN');
eq(debtLimited.purchaseCeilingCertificate.reason, 'NO_MONOTONE_GATE_AT_NEXT_HALALA');
eq(debtLimited.purchaseCeilingCertificate.price, null);
ok(debtLimited.purchaseCeilingCertificate.nextFailedCriteria.includes('LEVERED_NPV_NON_NEGATIVE'));
const irrOnly = state({ ...base, discountRate: .5 }, 'V2');
eq(irrOnly.purchaseCeilingCertificate.reason, 'NO_MONOTONE_GATE_AT_NEXT_HALALA');
eq(irrOnly.purchaseCeilingCertificate.nextFailedCriteria, ['IRR_MEETS_HURDLE']);
eq(irrOnly.purchaseCeilingCertificate.price, null, 'IRR-only numerical threshold does not inherit an unsupported monotonicity proof');
eq(certifyPurchaseCeiling(base, 'LEGACY', Math.floor(complete.price * 50) / 100).status, 'NOT_PROVEN', 'an arbitrary cheaper passing point is not a maximum');
const negativeYear = state({ ...base, leaseStatus: 'سنة', insuranceRateOnReplacementCost: .005 });
eq(negativeYear.purchaseCeilingCertificate.reason, 'NONNEGATIVE_FUTURE_FLOWS_REQUIRED');
for (const field of ['exitCapRate', 'exitTransferFeeRate']) {
  const missing = { ...base }; delete missing[field];
  for (const version of ['LEGACY', 'V2']) eq(state(missing, version).purchaseCeilingCertificate.maximumProvenWithinModel, false);
}
const unsupportedCoverage = state({ ...base, leaseYears: 6 });
eq(unsupportedCoverage.purchaseCeilingCertificate.reason, 'EXPLICIT_EXIT_AND_LEASE_COVERAGE_REQUIRED');
eq(unsupportedCoverage.purchaseCeilingCertificate.requiredLeaseCoverageYears, 10);
for (const candidate of [null, undefined, NaN, Infinity, -1, 0, .001, 1.234, Number.MAX_SAFE_INTEGER]) {
  const c = certifyPurchaseCeiling(base, 'LEGACY', candidate);
  eq(c.status, 'NOT_PROVEN'); eq(c.price, null); eq(c.maximumProvenWithinModel, false);
}
eq(certifyPurchaseCeiling({ ...base, rentPerSqm: 0 }, 'LEGACY', complete.price).price, null, 'old price is never reused for different inputs');
const skipped = calculateUiInvestmentState({ mode: 'building', inputs: base, assumptionModelVersion: 'LEGACY', includePurchaseAlternative: false });
eq(skipped.results.purchaseCeilingCertificate, undefined);
const toy = { ...base, floorCount: 1, floorAreaEach: 1, efficiencyRatio: 1, netLeasableOverride: 0,
  rentPerSqm: 1, occupancyRate: 1, maintenanceRate: 0, variableOpexRate: 0, managementFeeRate: 0,
  fixedOpexPerSqm: 0, replacementReservePerSqm: 0, insuranceRateOnReplacementCost: 0,
  serviceIncomeRate: 0, commissionRate: 0, transferFeeRate: 0, inspectionCost: 0, valuationCost: 0,
  minYieldThreshold: .5, discountRate: .08, leverageEnabled: false };
const toyCertificate = state(toy).purchaseCeilingCertificate;
eq(toyCertificate.price, 2);
let exhaustiveMaximum = null;
for (let minor = 1; minor <= 300; minor++) {
  if (qualifyPurchaseBoundary(toy, 'LEGACY', minor / 100).qualifiedPrice != null) exhaustiveMaximum = minor / 100;
}
eq(toyCertificate.price, exhaustiveMaximum, 'independent exhaustive small-grid maximum agrees');
const report = buildPersonalFinancialStudy({ mode: 'building', inputs: base, assumptionModelVersion: 'LEGACY' });
eq(report.financial.results.purchaseCeilingCertificate, complete);
ok(verifyPersonalFinancialStudy(report));
const tampered = JSON.parse(JSON.stringify(report)); tampered.financial.results.purchaseCeilingCertificate.proof.nextNpvMinor = '1';
eq(verifyPersonalFinancialStudy(tampered), false);
for (const locale of ['ar-SA', 'en']) {
  const html = htmlFinancialStudy(report, { locale });
  ok(html.includes(locale === 'en' ? 'Highest passing price proven within the model' : 'أعلى سعر مجتاز مثبت ضمن النموذج'));
  ok(purchaseCeilingCertificateMessage(complete, locale).includes(locale === 'en' ? 'Not independently verified' : 'ليس قيمة سوقية'));
}
console.log(`PURCHASE_CEILING_CERTIFICATE=PASS checks=${checks} (four monotone exclusions, financing/zero debt, independent rational oracle, exhaustive grid, abstention, report hash)`);
