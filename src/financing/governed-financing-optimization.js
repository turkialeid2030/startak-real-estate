'use strict';

const crypto = require('crypto');

const CAPABILITY = 'C14_GOVERNED_FINANCING_OPTION_COMPARISON_V1';
const POLICY_VERSION = 'C14_FINANCING_COMPARISON_POLICY_V1';

const FINANCING_STATUS = Object.freeze({
  READY_FOR_PROFESSIONAL_FINANCING_REVIEW: 'READY_FOR_PROFESSIONAL_FINANCING_REVIEW',
  HOLD_CONTEXT: 'HOLD_CONTEXT',
  HOLD_EVIDENCE: 'HOLD_EVIDENCE',
  HOLD_INTEGRITY: 'HOLD_INTEGRITY',
  HOLD_POLICY: 'HOLD_POLICY',
  HOLD_COMPARABILITY: 'HOLD_COMPARABILITY',
  HOLD_CALCULATION: 'HOLD_CALCULATION',
});

const PAYMENT_KIND = Object.freeze({
  DEBT_SERVICE: 'DEBT_SERVICE',
  BALLOON: 'BALLOON',
  OTHER_CONTRACTUAL_FINANCING_PAYMENT: 'OTHER_CONTRACTUAL_FINANCING_PAYMENT',
});

const COMPARISON_METRIC = Object.freeze({
  UPFRONT_FEES_SAR: 'UPFRONT_FEES_SAR',
  TOTAL_SCHEDULED_PAYMENTS_SAR: 'TOTAL_SCHEDULED_PAYMENTS_SAR',
  NOMINAL_FINANCING_COST_SAR: 'NOMINAL_FINANCING_COST_SAR',
  NOMINAL_FINANCING_COST_RATIO: 'NOMINAL_FINANCING_COST_RATIO',
  MAX_CALENDAR_YEAR_DEBT_SERVICE_SAR: 'MAX_CALENDAR_YEAR_DEBT_SERVICE_SAR',
  BALLOON_TOTAL_SAR: 'BALLOON_TOTAL_SAR',
  TENOR_DAYS: 'TENOR_DAYS',
});

const DIRECTION = Object.freeze({ MIN: 'MIN', MAX: 'MAX' });
const DISCLOSURE_FIELD = Object.freeze({ RATE: 'RATE', COVENANTS: 'COVENANTS', SECURITY: 'SECURITY' });

const nonEmpty = (v) => typeof v === 'string' && v.trim().length > 0;
const clean = (v) => nonEmpty(v) ? v.trim() : '';
const validSha = (v) => typeof v === 'string' && /^[a-f0-9]{64}$/i.test(v);
const finiteNN = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0;
const finitePositive = (v) => typeof v === 'number' && Number.isFinite(v) && v > 0;

function iso(v, field) {
  if (!nonEmpty(v) || !Number.isFinite(Date.parse(v))) throw new TypeError(`${field} must be a valid date/time`);
  return new Date(v).toISOString();
}

function stable(v) {
  if (Array.isArray(v)) return v.map(stable);
  if (!v || typeof v !== 'object') return v;
  return Object.keys(v).sort().reduce((out, key) => {
    out[key] = stable(v[key]);
    return out;
  }, {});
}

function sha256(v) {
  try {
    return crypto.createHash('sha256').update(JSON.stringify(stable(v))).digest('hex');
  } catch (_) {
    return null;
  }
}

function without(v, fields) {
  const out = { ...v };
  fields.forEach((field) => delete out[field]);
  return out;
}

function freeze(v) {
  if (!v || typeof v !== 'object' || Object.isFrozen(v)) return v;
  Object.values(v).forEach(freeze);
  return Object.freeze(v);
}

function normalizeStringArray(values, field) {
  if (values == null) return [];
  if (!Array.isArray(values) || values.some((v) => !nonEmpty(v))) {
    throw new TypeError(`${field} must be an array of non-empty strings`);
  }
  return [...new Set(values.map((v) => v.trim()))].sort();
}

function normalizePaymentSchedule(schedule) {
  if (!Array.isArray(schedule) || !schedule.length) throw new TypeError('C14_REPAYMENT_SCHEDULE_REQUIRED');
  const seen = new Set();
  const normalized = schedule.map((p, index) => {
    if (!p || typeof p !== 'object' || Array.isArray(p)) throw new TypeError(`C14_PAYMENT_OBJECT_REQUIRED:${index}`);
    if (!nonEmpty(p.paymentId)) throw new TypeError(`C14_PAYMENT_ID_REQUIRED:${index}`);
    const paymentId = p.paymentId.trim();
    if (seen.has(paymentId)) throw new TypeError(`C14_DUPLICATE_PAYMENT_ID:${paymentId}`);
    seen.add(paymentId);
    if (!Object.values(PAYMENT_KIND).includes(p.paymentKind)) throw new TypeError(`C14_PAYMENT_KIND_UNSUPPORTED:${paymentId}`);
    if (!finitePositive(p.amountSar)) throw new TypeError(`C14_PAYMENT_AMOUNT_INVALID:${paymentId}`);
    return {
      paymentId,
      paymentDate: iso(p.paymentDate, `repaymentSchedule.${paymentId}.paymentDate`),
      paymentKind: p.paymentKind,
      amountSar: p.amountSar,
    };
  });
  normalized.sort((a, b) => a.paymentDate.localeCompare(b.paymentDate) || a.paymentId.localeCompare(b.paymentId));
  return normalized;
}

function computeFinancingOfferHash(offer) {
  return offer && typeof offer === 'object' && !Array.isArray(offer)
    ? sha256(without(offer, ['financingOfferHashSha256']))
    : null;
}

function verifyFinancingOfferIntegrity(offer) {
  return !!offer
    && validSha(offer.financingOfferHashSha256)
    && computeFinancingOfferHash(offer) === offer.financingOfferHashSha256.toLowerCase();
}

function createGovernedFinancingOffer(x = {}) {
  const requiredStrings = [
    'offerId', 'caseId', 'propertyRef', 'providerRef', 'structureLabel',
    'sourceAuthority', 'sourceRef', 'sourceEvidenceRef',
    'professionalReviewerRef', 'reviewEvidenceRef',
  ];
  requiredStrings.forEach((field) => {
    if (!nonEmpty(x[field])) throw new TypeError(`${field} must be a non-empty string`);
  });
  if ((x.currency || 'SAR') !== 'SAR') throw new TypeError('C14_PHASE0_REQUIRES_SAR');
  if (!finitePositive(x.comparisonPrincipalSar)) throw new TypeError('C14_COMPARISON_PRINCIPAL_INVALID');
  if (!finiteNN(x.upfrontFeesSar)) throw new TypeError('C14_UPFRONT_FEES_INVALID');
  if (x.upfrontFeesOutsideRepaymentSchedule !== true) throw new TypeError('C14_UPFRONT_FEES_SCHEDULE_TREATMENT_REQUIRED');
  if (x.repaymentScheduleComplete !== true) throw new TypeError('C14_COMPLETE_REPAYMENT_SCHEDULE_REQUIRED');
  if (!validSha(x.sourceVersionHashSha256)) throw new TypeError('C14_SOURCE_VERSION_HASH_REQUIRED');
  if (!validSha(x.reviewEvidenceHashSha256)) throw new TypeError('C14_REVIEW_EVIDENCE_HASH_REQUIRED');

  const sourceVerifiedAt = iso(x.sourceVerifiedAt, 'sourceVerifiedAt');
  const sourceReviewAfter = iso(x.sourceReviewAfter, 'sourceReviewAfter');
  const reviewedAt = iso(x.reviewedAt, 'reviewedAt');
  const validUntil = iso(x.validUntil, 'validUntil');
  const quotedFundingDate = iso(x.quotedFundingDate, 'quotedFundingDate');
  const quoteValidUntil = iso(x.quoteValidUntil, 'quoteValidUntil');
  const maturityDate = iso(x.maturityDate, 'maturityDate');
  if (Date.parse(sourceReviewAfter) < Date.parse(sourceVerifiedAt)) throw new TypeError('C14_SOURCE_REVIEW_AFTER_BEFORE_VERIFIED_AT');
  if (Date.parse(validUntil) < Date.parse(reviewedAt)) throw new TypeError('C14_VALID_UNTIL_BEFORE_REVIEWED_AT');

  const repaymentSchedule = normalizePaymentSchedule(x.repaymentSchedule);
  const rateDisclosureRef = nonEmpty(x.rateDisclosureRef) ? x.rateDisclosureRef.trim() : null;
  const covenantEvidenceRefs = normalizeStringArray(x.covenantEvidenceRefs, 'covenantEvidenceRefs');
  const securityEvidenceRefs = normalizeStringArray(x.securityEvidenceRefs, 'securityEvidenceRefs');

  const core = {
    schemaVersion: 1,
    offerId: x.offerId.trim(),
    caseId: x.caseId.trim(),
    propertyRef: x.propertyRef.trim(),
    providerRef: x.providerRef.trim(),
    structureLabel: x.structureLabel.trim(),
    currency: 'SAR',
    comparisonPrincipalSar: x.comparisonPrincipalSar,
    upfrontFeesSar: x.upfrontFeesSar,
    upfrontFeesOutsideRepaymentSchedule: true,
    repaymentScheduleComplete: true,
    repaymentSchedule,
    quotedFundingDate,
    quoteValidUntil,
    maturityDate,
    rateDisclosureRef,
    covenantEvidenceRefs,
    securityEvidenceRefs,
    sourceAuthority: x.sourceAuthority.trim(),
    sourceRef: x.sourceRef.trim(),
    sourceEvidenceRef: x.sourceEvidenceRef.trim(),
    sourceVersionHashSha256: x.sourceVersionHashSha256.toLowerCase(),
    sourceVerifiedAt,
    sourceReviewAfter,
    professionalReviewerRef: x.professionalReviewerRef.trim(),
    reviewedAt,
    validUntil,
    reviewEvidenceRef: x.reviewEvidenceRef.trim(),
    reviewEvidenceHashSha256: x.reviewEvidenceHashSha256.toLowerCase(),
    termsExternallyDetermined: true,
    creditApprovalDeterminedBySoftware: false,
    shariaComplianceDeterminedBySoftware: false,
    legalDocumentEnforceabilityDeterminedBySoftware: false,
    securityPriorityDeterminedBySoftware: false,
    referenceRateForecastedBySoftware: false,
  };
  return freeze({ ...core, financingOfferHashSha256: sha256(core) });
}

function financingOfferBindings(offers) {
  if (!Array.isArray(offers)) return [];
  return offers.map((offer) => ({
    offerId: clean(offer?.offerId) || null,
    financingOfferHashSha256: clean(offer?.financingOfferHashSha256).toLowerCase() || null,
  })).sort((a, b) => String(a.offerId).localeCompare(String(b.offerId)));
}

function computeFinancingComparisonPolicyHash(policy) {
  return policy && typeof policy === 'object' && !Array.isArray(policy)
    ? sha256(without(policy, ['policyHashSha256']))
    : null;
}

function normalizeCriterion(criterion) {
  if (!criterion || typeof criterion !== 'object' || Array.isArray(criterion)) return null;
  if (!Object.values(COMPARISON_METRIC).includes(criterion.metric)) return null;
  if (!Object.values(DIRECTION).includes(criterion.direction)) return null;
  return { metric: criterion.metric, direction: criterion.direction };
}

function normalizeThreshold(threshold) {
  if (!threshold || typeof threshold !== 'object' || Array.isArray(threshold)) return null;
  if (!Object.values(COMPARISON_METRIC).includes(threshold.metric)) return null;
  if (!Object.values(DIRECTION).includes(threshold.operator)) return null;
  if (typeof threshold.value !== 'number' || !Number.isFinite(threshold.value)) return null;
  return { metric: threshold.metric, operator: threshold.operator, value: threshold.value };
}

function validatePolicy(policy, context) {
  const blockers = [];
  if (!policy || typeof policy !== 'object' || Array.isArray(policy)) return ['C14_GOVERNED_POLICY_OBJECT_REQUIRED'];
  if (clean(policy.version) !== POLICY_VERSION) blockers.push('C14_POLICY_VERSION_MISMATCH');
  if (clean(policy.policyId) !== context.policyId) blockers.push('C14_POLICY_ID_MISMATCH');
  if (clean(policy.caseId) !== context.caseId) blockers.push('C14_POLICY_CASE_MISMATCH');
  if (clean(policy.propertyRef) !== context.propertyRef) blockers.push('C14_POLICY_PROPERTY_MISMATCH');

  for (const [field, label, expected] of [
    ['asOfDate', 'AS_OF_DATE', context.asOfDate],
    ['targetFundingDate', 'TARGET_FUNDING_DATE', context.targetFundingDate],
  ]) {
    let actual = null;
    try { actual = iso(policy[field], `policy.${field}`); } catch (_) { blockers.push(`C14_POLICY_${label}_INVALID`); }
    if (actual && actual !== expected) blockers.push(`C14_POLICY_${label}_MISMATCH`);
  }

  if (JSON.stringify(financingOfferBindings(policy.offerBindings)) !== JSON.stringify(context.offerBindings)) {
    blockers.push('C14_POLICY_OFFER_BINDINGS_MISMATCH');
  }

  const allowedStructureLabels = Array.isArray(policy.allowedStructureLabels)
    ? [...new Set(policy.allowedStructureLabels.map((x) => clean(x)).filter(Boolean))].sort()
    : [];
  if (
    !Array.isArray(policy.allowedStructureLabels)
    || !policy.allowedStructureLabels.length
    || policy.allowedStructureLabels.some((x) => !nonEmpty(x))
    || !allowedStructureLabels.length
  ) blockers.push('C14_POLICY_ALLOWED_STRUCTURES_REQUIRED');
  if (typeof policy.requireEqualComparisonPrincipal !== 'boolean') blockers.push('C14_POLICY_EQUAL_PRINCIPAL_RULE_REQUIRED');

  const criteria = Array.isArray(policy.rankingCriteria) ? policy.rankingCriteria.map(normalizeCriterion) : [];
  if (!criteria.length || criteria.some((x) => !x)) blockers.push('C14_POLICY_RANKING_CRITERIA_INVALID');
  const criterionKeys = criteria.filter(Boolean).map((x) => `${x.metric}:${x.direction}`);
  if (new Set(criterionKeys).size !== criterionKeys.length) blockers.push('C14_POLICY_DUPLICATE_RANKING_CRITERION');
  const criterionMetrics = criteria.filter(Boolean).map((x) => x.metric);
  if (new Set(criterionMetrics).size !== criterionMetrics.length) blockers.push('C14_POLICY_DUPLICATE_RANKING_METRIC');

  const requiredDisclosureFields = Array.isArray(policy.requiredDisclosureFields)
    ? [...new Set(policy.requiredDisclosureFields)]
    : [];
  if (policy.requiredDisclosureFields != null && !Array.isArray(policy.requiredDisclosureFields)) {
    blockers.push('C14_POLICY_REQUIRED_DISCLOSURES_INVALID');
  }
  if (requiredDisclosureFields.some((x) => !Object.values(DISCLOSURE_FIELD).includes(x))) {
    blockers.push('C14_POLICY_REQUIRED_DISCLOSURES_INVALID');
  }

  const thresholds = policy.reviewThresholds == null
    ? []
    : Array.isArray(policy.reviewThresholds)
      ? policy.reviewThresholds.map(normalizeThreshold)
      : [null];
  if (thresholds.some((x) => !x)) blockers.push('C14_POLICY_REVIEW_THRESHOLDS_INVALID');
  const thresholdKeys = thresholds.filter(Boolean).map((x) => `${x.metric}:${x.operator}`);
  if (new Set(thresholdKeys).size !== thresholdKeys.length) blockers.push('C14_POLICY_DUPLICATE_REVIEW_THRESHOLD');

  if (!nonEmpty(policy.reviewedByRef)) blockers.push('C14_POLICY_REVIEWER_REQUIRED');
  if (!nonEmpty(policy.reviewEvidenceRef)) blockers.push('C14_POLICY_REVIEW_EVIDENCE_REQUIRED');
  let reviewedAt = null;
  try { reviewedAt = iso(policy.reviewedAt, 'policy.reviewedAt'); } catch (_) { blockers.push('C14_POLICY_REVIEWED_AT_INVALID'); }
  if (reviewedAt && Date.parse(reviewedAt) > Date.parse(context.asOfDate)) blockers.push('C14_POLICY_REVIEW_AFTER_AS_OF');

  const hash = computeFinancingComparisonPolicyHash(policy);
  if (!validSha(policy.policyHashSha256) || !hash || hash !== policy.policyHashSha256.toLowerCase()) blockers.push('C14_POLICY_INTEGRITY_HASH_MISMATCH');
  return blockers;
}

function metricsForOffer(offer, targetFundingDate) {
  const totalScheduledPaymentsSar = offer.repaymentSchedule.reduce((sum, payment) => sum + payment.amountSar, 0);
  const nominalFinancingCostSar = offer.upfrontFeesSar + totalScheduledPaymentsSar - offer.comparisonPrincipalSar;
  const nominalFinancingCostRatio = nominalFinancingCostSar / offer.comparisonPrincipalSar;
  const annual = new Map();
  let balloonTotalSar = 0;
  for (const payment of offer.repaymentSchedule) {
    const year = new Date(payment.paymentDate).getUTCFullYear();
    annual.set(year, (annual.get(year) || 0) + payment.amountSar);
    if (payment.paymentKind === PAYMENT_KIND.BALLOON) balloonTotalSar += payment.amountSar;
  }
  const annualDebtService = [...annual.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([year, amountSar]) => ({ year, amountSar }));
  const maxCalendarYearDebtServiceSar = annualDebtService.reduce((max, x) => Math.max(max, x.amountSar), 0);
  const tenorDays = (Date.parse(offer.maturityDate) - Date.parse(targetFundingDate)) / 86400000;

  const metrics = {
    upfrontFeesSar: offer.upfrontFeesSar,
    totalScheduledPaymentsSar,
    nominalFinancingCostSar,
    nominalFinancingCostRatio,
    maxCalendarYearDebtServiceSar,
    balloonTotalSar,
    tenorDays,
  };
  if (Object.values(metrics).some((v) => typeof v !== 'number' || !Number.isFinite(v))) return null;
  return { ...metrics, annualDebtService };
}

const METRIC_FIELD = Object.freeze({
  [COMPARISON_METRIC.UPFRONT_FEES_SAR]: 'upfrontFeesSar',
  [COMPARISON_METRIC.TOTAL_SCHEDULED_PAYMENTS_SAR]: 'totalScheduledPaymentsSar',
  [COMPARISON_METRIC.NOMINAL_FINANCING_COST_SAR]: 'nominalFinancingCostSar',
  [COMPARISON_METRIC.NOMINAL_FINANCING_COST_RATIO]: 'nominalFinancingCostRatio',
  [COMPARISON_METRIC.MAX_CALENDAR_YEAR_DEBT_SERVICE_SAR]: 'maxCalendarYearDebtServiceSar',
  [COMPARISON_METRIC.BALLOON_TOTAL_SAR]: 'balloonTotalSar',
  [COMPARISON_METRIC.TENOR_DAYS]: 'tenorDays',
});

function criterionValues(summary, criteria) {
  return criteria.map((criterion) => ({
    metric: criterion.metric,
    direction: criterion.direction,
    value: summary.metrics[METRIC_FIELD[criterion.metric]],
  }));
}

function compareSummaries(a, b, criteria) {
  for (const criterion of criteria) {
    const field = METRIC_FIELD[criterion.metric];
    const av = a.metrics[field];
    const bv = b.metrics[field];
    if (av === bv) continue;
    if (criterion.direction === DIRECTION.MIN) return av < bv ? -1 : 1;
    return av > bv ? -1 : 1;
  }
  return a.offerId.localeCompare(b.offerId);
}

function sameCriteria(a, b, criteria) {
  return criteria.every((criterion) => {
    const field = METRIC_FIELD[criterion.metric];
    return a.metrics[field] === b.metrics[field];
  });
}

function result(status, blockers, context = {}, offers = [], analyticalOrdering = [], riskFlags = []) {
  const ready = status === FINANCING_STATUS.READY_FOR_PROFESSIONAL_FINANCING_REVIEW;
  return freeze({
    capability: CAPABILITY,
    policyVersion: POLICY_VERSION,
    status,
    professionalFinancingReviewReady: ready,
    caseId: context.caseId || null,
    propertyRef: context.propertyRef || null,
    asOfDate: context.asOfDate || null,
    targetFundingDate: context.targetFundingDate || null,
    comparisonPolicyId: context.policyId || null,
    comparisonPolicyHashSha256: context.policyHashSha256 || null,
    offerBindings: context.offerBindings || [],
    offers: ready ? offers : [],
    analyticalOrdering: ready ? analyticalOrdering : [],
    riskFlags: ready ? riskFlags : [],
    blockers: [...new Set(blockers)],
    lenderSelected: false,
    creditApproved: false,
    financingCommitted: false,
    shariaComplianceDetermined: false,
    legalFinancingOpinionEstablished: false,
    securityPriorityDetermined: false,
    referenceRateForecastGenerated: false,
    dscrComplianceDetermined: false,
    ltvComplianceDetermined: false,
    valuationCalculated: false,
    npvCalculated: false,
    irrCalculated: false,
    automaticUnderwritingAdoption: false,
    automaticAcquisitionOrClosingRecommendation: false,
    transactionAuthorized: false,
    approvalAuthorized: false,
    decisionBinding: false,
    productionAuthorityGranted: false,
    publicAiAuthorized: false,
    commercialGoLiveAuthorized: false,
    canonicalBaselineActivationAuthorized: false,
    semantics: 'C14 compares explicit complete quoted financing cash flows under an integrity-bound caller policy. Analytical ordering is non-binding and does not select a lender, approve credit, determine Sharia/legal/security validity, forecast rates, or authorize a transaction.',
  });
}

function evaluateGovernedFinancingOptions(x = {}) {
  const context = {
    caseId: clean(x.caseId) || null,
    propertyRef: clean(x.propertyRef) || null,
    asOfDate: null,
    targetFundingDate: null,
    policyId: clean(x.comparisonPolicyId) || null,
    offerBindings: [],
  };
  const contextBlockers = [];
  if (!context.caseId) contextBlockers.push('C14_CASE_ID_REQUIRED');
  if (!context.propertyRef) contextBlockers.push('C14_PROPERTY_REF_REQUIRED');
  try { context.asOfDate = iso(x.asOfDate, 'asOfDate'); } catch (_) { contextBlockers.push('C14_AS_OF_DATE_INVALID'); }
  try { context.targetFundingDate = iso(x.targetFundingDate, 'targetFundingDate'); } catch (_) { contextBlockers.push('C14_TARGET_FUNDING_DATE_INVALID'); }
  if (context.asOfDate && context.targetFundingDate && Date.parse(context.targetFundingDate) < Date.parse(context.asOfDate)) {
    contextBlockers.push('C14_TARGET_FUNDING_BEFORE_AS_OF');
  }
  if (contextBlockers.length) return result(FINANCING_STATUS.HOLD_CONTEXT, contextBlockers, context);

  if (!Array.isArray(x.financingOffers) || !x.financingOffers.length) {
    return result(FINANCING_STATUS.HOLD_EVIDENCE, ['C14_FINANCING_OFFERS_REQUIRED'], context);
  }

  const evidenceBlockers = [];
  const seen = new Set();
  const validated = [];
  const asOf = Date.parse(context.asOfDate);
  const targetFunding = Date.parse(context.targetFundingDate);

  for (const offer of x.financingOffers) {
    const id = clean(offer?.offerId);
    if (!id) { evidenceBlockers.push('C14_OFFER_ID_REQUIRED'); continue; }
    if (seen.has(id)) { evidenceBlockers.push(`C14_DUPLICATE_OFFER_ID:${id}`); continue; }
    seen.add(id);
    if (!verifyFinancingOfferIntegrity(offer)) { evidenceBlockers.push(`C14_OFFER_INTEGRITY_FAILED:${id}`); continue; }
    if (clean(offer.caseId) !== context.caseId || clean(offer.propertyRef) !== context.propertyRef) {
      evidenceBlockers.push(`C14_OFFER_CONTEXT_MISMATCH:${id}`); continue;
    }
    const requiredOfferStrings = [
      offer.providerRef, offer.structureLabel, offer.sourceAuthority, offer.sourceRef,
      offer.sourceEvidenceRef, offer.professionalReviewerRef, offer.reviewEvidenceRef,
    ];
    if (requiredOfferStrings.some((v) => !nonEmpty(v))) {
      evidenceBlockers.push(`C14_OFFER_REQUIRED_METADATA_MISSING:${id}`); continue;
    }
    if (
      !Array.isArray(offer.covenantEvidenceRefs)
      || offer.covenantEvidenceRefs.some((v) => !nonEmpty(v))
      || !Array.isArray(offer.securityEvidenceRefs)
      || offer.securityEvidenceRefs.some((v) => !nonEmpty(v))
    ) {
      evidenceBlockers.push(`C14_OFFER_DISCLOSURE_REFERENCES_INVALID:${id}`); continue;
    }
    if (offer.currency !== 'SAR') { evidenceBlockers.push(`C14_OFFER_CURRENCY_INVALID:${id}`); continue; }
    if (!finitePositive(offer.comparisonPrincipalSar) || !finiteNN(offer.upfrontFeesSar)) {
      evidenceBlockers.push(`C14_OFFER_ECONOMICS_INVALID:${id}`); continue;
    }
    if (offer.upfrontFeesOutsideRepaymentSchedule !== true) {
      evidenceBlockers.push(`C14_UPFRONT_FEES_SCHEDULE_TREATMENT_INVALID:${id}`); continue;
    }
    if (offer.repaymentScheduleComplete !== true || !Array.isArray(offer.repaymentSchedule) || !offer.repaymentSchedule.length) {
      evidenceBlockers.push(`C14_REPAYMENT_SCHEDULE_INCOMPLETE:${id}`); continue;
    }
    const sv = Date.parse(offer.sourceVerifiedAt);
    const sr = Date.parse(offer.sourceReviewAfter);
    const rv = Date.parse(offer.reviewedAt);
    const vu = Date.parse(offer.validUntil);
    const quotedFunding = Date.parse(offer.quotedFundingDate);
    const qv = Date.parse(offer.quoteValidUntil);
    const maturity = Date.parse(offer.maturityDate);
    if (![sv, sr, rv, vu, quotedFunding, qv, maturity].every(Number.isFinite)) {
      evidenceBlockers.push(`C14_OFFER_DATES_INVALID:${id}`); continue;
    }
    if (sv > asOf || sr < asOf || sr < sv) { evidenceBlockers.push(`C14_SOURCE_STALE_OR_FUTURE:${id}`); continue; }
    if (rv > asOf) { evidenceBlockers.push(`C14_REVIEW_AFTER_AS_OF:${id}`); continue; }
    if (vu < targetFunding) { evidenceBlockers.push(`C14_EVIDENCE_EXPIRES_BEFORE_TARGET_FUNDING:${id}`); continue; }
    if (quotedFunding !== targetFunding) { evidenceBlockers.push(`C14_QUOTED_FUNDING_DATE_MISMATCH:${id}`); continue; }
    if (qv < targetFunding) { evidenceBlockers.push(`C14_QUOTE_EXPIRES_BEFORE_TARGET_FUNDING:${id}`); continue; }
    if (maturity < targetFunding) { evidenceBlockers.push(`C14_MATURITY_BEFORE_TARGET_FUNDING:${id}`); continue; }
    if (!validSha(offer.sourceVersionHashSha256) || !validSha(offer.reviewEvidenceHashSha256)) {
      evidenceBlockers.push(`C14_SOURCE_OR_REVIEW_HASH_INVALID:${id}`); continue;
    }
    if (
      offer.termsExternallyDetermined !== true
      || offer.creditApprovalDeterminedBySoftware !== false
      || offer.shariaComplianceDeterminedBySoftware !== false
      || offer.legalDocumentEnforceabilityDeterminedBySoftware !== false
      || offer.securityPriorityDeterminedBySoftware !== false
      || offer.referenceRateForecastedBySoftware !== false
    ) {
      evidenceBlockers.push(`C14_OFFER_AUTHORITY_INVALID:${id}`); continue;
    }

    const paymentIds = new Set();
    let scheduleInvalid = false;
    for (const payment of offer.repaymentSchedule) {
      const paymentId = clean(payment?.paymentId);
      if (!paymentId || paymentIds.has(paymentId)) { scheduleInvalid = true; break; }
      paymentIds.add(paymentId);
      if (!Object.values(PAYMENT_KIND).includes(payment.paymentKind) || !finitePositive(payment.amountSar)) { scheduleInvalid = true; break; }
      const paymentDate = Date.parse(payment.paymentDate);
      if (!Number.isFinite(paymentDate) || paymentDate < targetFunding || paymentDate > maturity) { scheduleInvalid = true; break; }
    }
    if (scheduleInvalid) { evidenceBlockers.push(`C14_REPAYMENT_SCHEDULE_INVALID:${id}`); continue; }

    const metrics = metricsForOffer(offer, context.targetFundingDate);
    if (!metrics) { evidenceBlockers.push(`C14_DERIVED_METRICS_INVALID:${id}`); continue; }
    validated.push({ offer, metrics });
  }

  if (evidenceBlockers.length) return result(FINANCING_STATUS.HOLD_INTEGRITY, evidenceBlockers, context);

  context.offerBindings = financingOfferBindings(validated.map((x) => x.offer));
  if (!context.policyId) return result(FINANCING_STATUS.HOLD_POLICY, ['C14_GOVERNED_POLICY_ID_REQUIRED'], context);
  if (!x.governedComparisonPolicies || typeof x.governedComparisonPolicies !== 'object' || Array.isArray(x.governedComparisonPolicies)) {
    return result(FINANCING_STATUS.HOLD_POLICY, ['C14_GOVERNED_POLICY_REGISTRY_REQUIRED'], context);
  }
  const policy = x.governedComparisonPolicies[context.policyId];
  if (!policy) return result(FINANCING_STATUS.HOLD_POLICY, [`C14_GOVERNED_POLICY_NOT_FOUND:${context.policyId}`], context);
  const policyBlockers = validatePolicy(policy, context);
  if (policyBlockers.some((b) => b.includes('INTEGRITY_HASH') || b.includes('BINDINGS_MISMATCH'))) {
    return result(FINANCING_STATUS.HOLD_INTEGRITY, policyBlockers, context);
  }
  if (policyBlockers.length) return result(FINANCING_STATUS.HOLD_POLICY, policyBlockers, context);
  context.policyHashSha256 = policy.policyHashSha256.toLowerCase();

  const allowedStructures = new Set(policy.allowedStructureLabels.map((x) => x.trim()));
  const requiredDisclosures = new Set(policy.requiredDisclosureFields || []);
  const comparabilityBlockers = [];

  for (const { offer } of validated) {
    if (!allowedStructures.has(offer.structureLabel)) {
      comparabilityBlockers.push(`C14_STRUCTURE_NOT_ALLOWED:${offer.offerId}:${offer.structureLabel}`);
    }
    if (requiredDisclosures.has(DISCLOSURE_FIELD.RATE) && !nonEmpty(offer.rateDisclosureRef)) {
      comparabilityBlockers.push(`C14_REQUIRED_RATE_DISCLOSURE_MISSING:${offer.offerId}`);
    }
    if (requiredDisclosures.has(DISCLOSURE_FIELD.COVENANTS) && (!Array.isArray(offer.covenantEvidenceRefs) || !offer.covenantEvidenceRefs.length)) {
      comparabilityBlockers.push(`C14_REQUIRED_COVENANT_EVIDENCE_MISSING:${offer.offerId}`);
    }
    if (requiredDisclosures.has(DISCLOSURE_FIELD.SECURITY) && (!Array.isArray(offer.securityEvidenceRefs) || !offer.securityEvidenceRefs.length)) {
      comparabilityBlockers.push(`C14_REQUIRED_SECURITY_EVIDENCE_MISSING:${offer.offerId}`);
    }
  }

  if (policy.requireEqualComparisonPrincipal) {
    const principals = [...new Set(validated.map(({ offer }) => offer.comparisonPrincipalSar))];
    if (principals.length > 1) comparabilityBlockers.push('C14_UNEQUAL_COMPARISON_PRINCIPALS');
  }
  if (comparabilityBlockers.length) return result(FINANCING_STATUS.HOLD_COMPARABILITY, comparabilityBlockers, context);

  const summaries = validated.map(({ offer, metrics }) => ({
    offerId: offer.offerId,
    providerRef: offer.providerRef,
    structureLabel: offer.structureLabel,
    currency: offer.currency,
    comparisonPrincipalSar: offer.comparisonPrincipalSar,
    quotedFundingDate: offer.quotedFundingDate,
    quoteValidUntil: offer.quoteValidUntil,
    maturityDate: offer.maturityDate,
    rateDisclosureRef: offer.rateDisclosureRef,
    covenantEvidenceRefs: offer.covenantEvidenceRefs,
    securityEvidenceRefs: offer.securityEvidenceRefs,
    metrics,
    repaymentSchedule: offer.repaymentSchedule,
    sourceAuthority: offer.sourceAuthority,
    sourceRef: offer.sourceRef,
    sourceEvidenceRef: offer.sourceEvidenceRef,
    sourceVersionHashSha256: offer.sourceVersionHashSha256,
    sourceVerifiedAt: offer.sourceVerifiedAt,
    sourceReviewAfter: offer.sourceReviewAfter,
    professionalReviewerRef: offer.professionalReviewerRef,
    reviewedAt: offer.reviewedAt,
    validUntil: offer.validUntil,
    reviewEvidenceRef: offer.reviewEvidenceRef,
    reviewEvidenceHashSha256: offer.reviewEvidenceHashSha256,
    financingOfferHashSha256: offer.financingOfferHashSha256,
  })).sort((a, b) => a.offerId.localeCompare(b.offerId));

  if (summaries.some((s) => Object.values(s.metrics).some((v) => Array.isArray(v) ? false : (typeof v === 'number' && !Number.isFinite(v))))) {
    return result(FINANCING_STATUS.HOLD_CALCULATION, ['C14_NON_FINITE_COMPARISON_METRIC'], context);
  }

  const criteria = policy.rankingCriteria.map(normalizeCriterion);
  const sorted = [...summaries].sort((a, b) => compareSummaries(a, b, criteria));
  const analyticalOrdering = [];
  for (let i = 0; i < sorted.length; i += 1) {
    let rank = i + 1;
    if (i > 0 && sameCriteria(sorted[i], sorted[i - 1], criteria)) rank = analyticalOrdering[i - 1].rank;
    analyticalOrdering.push({
      rank,
      offerId: sorted[i].offerId,
      criteria: criterionValues(sorted[i], criteria),
    });
  }
  for (const row of analyticalOrdering) {
    row.tiedWithOfferIds = analyticalOrdering
      .filter((other) => other.offerId !== row.offerId && other.rank === row.rank)
      .map((other) => other.offerId)
      .sort();
  }

  const thresholds = (policy.reviewThresholds || []).map(normalizeThreshold);
  const riskFlags = [];
  for (const summary of summaries) {
    for (const threshold of thresholds) {
      const field = METRIC_FIELD[threshold.metric];
      const observed = summary.metrics[field];
      const breached = threshold.operator === DIRECTION.MAX ? observed > threshold.value : observed < threshold.value;
      if (breached) {
        riskFlags.push(`REVIEW_THRESHOLD_${threshold.operator}_BREACHED:${summary.offerId}:${threshold.metric}:${observed}:${threshold.value}`);
      }
    }
  }
  riskFlags.sort();

  return result(
    FINANCING_STATUS.READY_FOR_PROFESSIONAL_FINANCING_REVIEW,
    [],
    context,
    summaries,
    analyticalOrdering,
    riskFlags,
  );
}

module.exports = {
  CAPABILITY,
  POLICY_VERSION,
  FINANCING_STATUS,
  PAYMENT_KIND,
  COMPARISON_METRIC,
  DIRECTION,
  DISCLOSURE_FIELD,
  createGovernedFinancingOffer,
  computeFinancingOfferHash,
  verifyFinancingOfferIntegrity,
  financingOfferBindings,
  computeFinancingComparisonPolicyHash,
  evaluateGovernedFinancingOptions,
};
