'use strict';
const { calculateInvestmentCase, STUDY_TYPE } = require('../engines');
const { precision } = require('../engines/financial');
const { qualifyPurchaseBoundary } = require('./purchase-boundary-qualification');

const VERSION = 'PURCHASE_CEILING_CERTIFICATE_V1';
const MONOTONE_GATES = ['NET_YIELD_ON_COST', 'CUMULATIVE_PAYBACK', 'NPV_NON_NEGATIVE', 'INCOME_VALUE_COVERS_COST'];
const MESSAGES = {
  QUALIFIED_CANDIDATE_REQUIRED: ['لا يوجد سعر مجتاز لجميع المعايير لإثبات حده الأعلى', 'A price passing every criterion is required before proving a ceiling'],
  HALALA_GRID_REQUIRED: ['السعر خارج شبكة الهللة الآمنة المدعومة', 'The price is outside the supported safe halala grid'],
  UNSUPPORTED_ENGINE: ['إصدار المحرك خارج نطاق برهان الحد الأعلى', 'The engine version is outside the ceiling proof scope'],
  EXPLICIT_EXIT_AND_LEASE_COVERAGE_REQUIRED: ['يلزم إدخال التخارج صراحةً وتغطية العقود لأفق التخارج والاسترداد المستخدم في البرهان', 'Explicit exit inputs and lease coverage through the exit and payback proof horizons are required'],
  NONNEGATIVE_FUTURE_FLOWS_REQUIRED: ['البرهان الحالي يتطلب تدفقات مستقبلية غير سالبة وعائدًا داخليًا موثوقًا من المحرك', 'This proof requires nonnegative future cash flows and a reliable canonical IRR'],
  PRICE_INVARIANTS_NOT_RECONCILED: ['لم تتطابق ثوابت الدخل والتكلفة اللازمة للبرهان', 'The income and cost invariants required for proof did not reconcile'],
  NO_MONOTONE_GATE_AT_NEXT_HALALA: ['لا يوجد قيد مدعوم يستبعد كل الأسعار الأعلى؛ يبقى السعر بديلًا متحققًا عند قيمته فقط', 'No supported gate excludes every higher price; the price remains verified only at that point'],
  CALCULATION_UNAVAILABLE: ['تعذر استكمال برهان الحد الأعلى من المدخلات الحالية', 'The ceiling proof could not be completed from current inputs'],
};
function purchaseCeilingCertificateMessage(certificate, locale = 'ar-SA') {
  if (certificate?.status === 'PROVEN_WITHIN_MODEL' && certificate.maximumProvenWithinModel === true) {
    return locale === 'en'
      ? 'Highest passing price proven on the 0.01 SAR grid within the supported model and unchanged inputs. Not independently verified market value or purchase authorization. Separate Zakat and source-dated operating cash overlays are not included.'
      : 'أعلى سعر مجتاز مثبت على شبكة الهللة ضمن النموذج المدعوم والمدخلات نفسها. ليس قيمة سوقية متحققًا منها مستقلًا ولا تفويضًا بالشراء. لا يشمل طبقات الزكاة والتدفقات التشغيلية المنفصلة.';
  }
  return (MESSAGES[certificate?.reason] || MESSAGES.CALCULATION_UNAVAILABLE)[locale === 'en' ? 1 : 0];
}
const equalSeries = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === b.length
  && a.every((value, index) => Number.isFinite(value) && value === b[index]);
const acquisitionCost = (inputs, price) => price + price * inputs.commissionRate
  + price * inputs.transferFeeRate + inputs.inspectionCost + inputs.valuationCost;

/**
 * This is an exclusion certificate, NOT an inference of global monotonicity
 * from adjacent samples. The pinned Building Wave-A equations make future
 * unlevered flows/NOI/income value independent of purchase price. Acquisition
 * cost increases monotonically with price and nonnegative loads/fixed costs.
 * Each listed necessary gate can only worsen as that cost increases:
 *   yield = NOI/C; value coverage = V >= C;
 *   NPV = fixed rounded future PV - rounded C;
 *   payback = first cumulative recovery crossing of C (no sale proceeds).
 * Thus a full-engine passing point and one such gate failing at the next
 * halala exclude ALL higher grid points, regardless of other gates/debt's
 * monotonicity. Versions, explicit assumptions and invariants fail closed.
 * See docs/PURCHASE_CEILING_CERTIFICATE.md for proof and numeric boundaries.
 */
function certifyPurchaseCeiling(inputs, assumptionModelVersion, candidatePrice) {
  const base = { version: VERSION, status: 'NOT_PROVEN', price: null,
    maximumProvenWithinModel: false, transactionAuthorized: false, sourceIndependentlyVerified: false,
    scope: { studyType: STUDY_TYPE.EXISTING_BUILDING, priceStepSar: 0.01,
      minimumPriceMinor: 1, maximumPriceMinor: Number.MAX_SAFE_INTEGER,
      unchangedInputsExcept: 'buildingPrice', finiteCanonicalCalculationsOnly: true,
      excludedLayers: ['USER_ENTERED_ZAKAT_OVERLAY', 'SOURCE_DATED_OPERATING_CASH_SCENARIO', 'INDEPENDENT_MARKET_EVIDENCE'] },
    blockingCriteria: [], reason: 'QUALIFIED_CANDIDATE_REQUIRED' };
  if (!Number.isFinite(candidatePrice) || candidatePrice <= 0) return base;
  const minor = Math.round(candidatePrice * 100), nextPrice = (minor + 1) / 100;
  if (!Number.isSafeInteger(minor) || minor < 1 || !Number.isSafeInteger(minor + 1)
      || minor / 100 !== candidatePrice || nextPrice <= candidatePrice
      || Math.round(nextPrice * 100) !== minor + 1) return { ...base, reason: 'HALALA_GRID_REQUIRED' };
  try {
    const qualification = qualifyPurchaseBoundary(inputs, assumptionModelVersion, candidatePrice);
    if (qualification.qualifiedPrice !== candidatePrice) return base;
    const run = buildingPrice => calculateInvestmentCase({ studyType: STUDY_TYPE.EXISTING_BUILDING,
      inputs: { ...inputs, buildingPrice }, leverageEnabled: Boolean(inputs.leverageEnabled), assumptionModelVersion });
    const current = run(candidatePrice), next = run(nextPrice);
    if ([current, next].some(r => r.financialModelVersion !== 'BUILDING_WAVE_A_2.0'
        || r.priceBasis?.version !== 'PRICE_BASIS_V1'
        || r.priceBasis?.outputBasis !== 'BASE_BUILDING_PURCHASE_PRICE_SAR'
        || (r.financingEngineVersion && r.financingEngineVersion !== 'MONTHLY_DSCR_WAVE_B_1.0'))) {
      return { ...base, reason: 'UNSUPPORTED_ENGINE' };
    }
    const requiredLeaseCoverageYears = Math.max(inputs.holdPeriod + 1,
      Math.min(inputs.maxPaybackThreshold, current.paybackNoiCashflows?.length || 0));
    if (inputs.leaseYears < requiredLeaseCoverageYears || [current, next].some(r => r.financialModelStatus !== 'VALID'
        || r.exitCapSource !== 'EXPLICIT' || r.exitTransactionCostSource !== 'EXPLICIT'
        || r.leaseDependentAnalyticsReady !== true || r.cashflowsIncludeTerminalValue !== true)) {
      return { ...base, reason: 'EXPLICIT_EXIT_AND_LEASE_COVERAGE_REQUIRED', requiredLeaseCoverageYears };
    }
    if (!Array.isArray(current.cashflows) || current.cashflows.length < 2 || current.cashflows[0] >= 0
        || current.cashflows.slice(1).some(x => !Number.isFinite(x) || x < 0)
        || !current.cashflows.slice(1).some(x => x > 0) || current.irrReliability !== 'RELIABLE') {
      return { ...base, reason: 'NONNEGATIVE_FUTURE_FLOWS_REQUIRED' };
    }
    const costInputs = ['commissionRate', 'transferFeeRate', 'inspectionCost', 'valuationCost'];
    if (!costInputs.every(key => Number.isFinite(inputs[key]) && inputs[key] >= 0)
        || !equalSeries(current.cashflows.slice(1), next.cashflows?.slice(1))
        || !equalSeries(current.paybackNoiCashflows, next.paybackNoiCashflows)
        || current.NOI !== next.NOI || !(current.NOI > 0)
        || current.marketValueByIncomeCap !== next.marketValueByIncomeCap
        || !Number.isFinite(current.marketValueByIncomeCap)
        || current.totalPurchaseCost !== acquisitionCost(inputs, candidatePrice)
        || next.totalPurchaseCost !== acquisitionCost(inputs, nextPrice)
        || !(next.totalPurchaseCost > current.totalPurchaseCost)
        || current.cashflows[0] !== -current.totalPurchaseCost || next.cashflows[0] !== -next.totalPurchaseCost) {
      return { ...base, reason: 'PRICE_INVARIANTS_NOT_RECONCILED' };
    }
    const futurePvMinor = precision.npvScaled(inputs.discountRate, [0, ...current.cashflows.slice(1)]);
    const nextCostMinor = precision.toMoney(next.totalPurchaseCost);
    const nextNpvMinor = precision.npvScaled(inputs.discountRate, next.cashflows);
    const safeMoney = [...current.cashflows, ...next.cashflows, ...current.paybackNoiCashflows,
      current.NOI, current.marketValueByIncomeCap].map(precision.toMoney);
    safeMoney.push(futurePvMinor, nextNpvMinor);
    if (safeMoney.some(x => x > BigInt(Number.MAX_SAFE_INTEGER) || x < -BigInt(Number.MAX_SAFE_INTEGER)
        || precision.toMoney(precision.fromMoney(x)) !== x)) {
      return { ...base, reason: 'PRICE_INVARIANTS_NOT_RECONCILED' };
    }
    const futurePresentValueSar = precision.fromMoney(futurePvMinor);
    const npvReconciles = nextNpvMinor === futurePvMinor - nextCostMinor
      && next.npv === precision.fromMoney(nextNpvMinor);
    const exclusions = {
      NET_YIELD_ON_COST: next.netYieldOnCost < inputs.minYieldThreshold,
      CUMULATIVE_PAYBACK: next.cumulativePaybackOnCost === null || next.cumulativePaybackOnCost > inputs.maxPaybackThreshold,
      NPV_NON_NEGATIVE: npvReconciles && next.npv < 0,
      INCOME_VALUE_COVERS_COST: next.marketValueByIncomeCap < next.totalPurchaseCost,
    };
    const blockingCriteria = MONOTONE_GATES.filter(code => exclusions[code]
      && next.criteriaDetail?.some(c => c.code === code && c.met === false));
    if (!blockingCriteria.length) return { ...base, reason: 'NO_MONOTONE_GATE_AT_NEXT_HALALA',
      nextPrice, nextFailedCriteria: next.criteriaDetail?.filter(c => c.met !== true).map(c => c.code) || [] };
    return { ...base, status: 'PROVEN_WITHIN_MODEL', price: candidatePrice, nextPrice,
      maximumProvenWithinModel: true, reason: null, blockingCriteria, qualification, requiredLeaseCoverageYears,
      proof: { method: 'PASSING_POINT_PLUS_MONOTONE_NECESSARY_GATE_EXCLUSION',
        financialModelVersion: current.financialModelVersion, assumptionModelVersion: current.assumptionModelVersion,
        financingEngineVersion: current.financingEngineVersion || null,
        costFormula: 'P + P*commissionRate + P*transferFeeRate + inspectionCost + valuationCost',
        costInputs: Object.fromEntries(costInputs.map(key => [key, inputs[key]])),
        acquisitionCostSar: current.totalPurchaseCost, nextAcquisitionCostSar: next.totalPurchaseCost,
        stabilizedNoiSar: current.NOI, incomeValueSar: current.marketValueByIncomeCap,
        futureUnleveredCashflows: current.cashflows.slice(1), paybackOperatingCashflows: current.paybackNoiCashflows,
        discountRate: inputs.discountRate, minYieldThreshold: inputs.minYieldThreshold,
        maxPaybackThreshold: inputs.maxPaybackThreshold, futurePresentValueSar,
        futurePresentValueMinor: String(futurePvMinor), nextAcquisitionCostMinor: String(nextCostMinor),
        nextNpvMinor: String(nextNpvMinor),
        npvPrecision: 'HALALA_CASHFLOWS_AND_EACH_DISCOUNTED_CONTRIBUTION_RATE_12_DECIMALS',
        nextCriteria: next.criteriaDetail, nextNpvSar: next.npv,
        nextNetYieldOnCost: next.netYieldOnCost, nextPaybackYears: next.cumulativePaybackOnCost },
    };
  } catch (_) { return { ...base, reason: 'CALCULATION_UNAVAILABLE' }; }
}
module.exports = { certifyPurchaseCeiling, purchaseCeilingCertificateMessage, VERSION };
