'use strict';

const COMPARATOR_TYPE = Object.freeze({
  INDEPENDENT_APPRAISAL: 'INDEPENDENT_APPRAISAL',
  ACTUAL_TRANSACTION: 'ACTUAL_TRANSACTION',
});

const EXTERNAL_VALUATION_VALIDATION_STATUS = Object.freeze({
  VALIDATED_WITHIN_POLICY: 'VALIDATED_WITHIN_POLICY',
  UNRATED_POLICY_REQUIRED: 'UNRATED_POLICY_REQUIRED',
  HOLD_EVIDENCE: 'HOLD_EVIDENCE',
  HOLD_COMPARABILITY: 'HOLD_COMPARABILITY',
  HOLD_MIN_SAMPLE: 'HOLD_MIN_SAMPLE',
  HOLD_THRESHOLD: 'HOLD_THRESHOLD',
});

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function finitePositive(value) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function isDate(value) {
  return nonEmptyString(value) && Number.isFinite(Date.parse(value));
}

function median(values) {
  if (!Array.isArray(values) || values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function mean(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function validatePolicy(policy) {
  if (!policy || typeof policy !== 'object' || Array.isArray(policy)) return false;
  if (!Number.isInteger(policy.minObservations) || policy.minObservations < 1) return false;
  if (!Number.isFinite(policy.maxDateGapDays) || policy.maxDateGapDays < 0) return false;
  if (!Number.isFinite(policy.maxMedianAbsolutePercentageError) || policy.maxMedianAbsolutePercentageError < 0) return false;
  if (!Number.isFinite(policy.maxAbsoluteMedianSignedPercentageError) || policy.maxAbsoluteMedianSignedPercentageError < 0) return false;
  return true;
}

function hold(status, reasons, observations = [], metrics = null) {
  return {
    status,
    reasons,
    observations,
    metrics,
    validationPolicyPassed: false,
    certifiedValuationEstablished: false,
    productionDecisionAuthorized: false,
    humanReviewRequired: true,
    statisticalConfidenceEstablished: false,
  };
}

function evaluateExternalValuationValidation({ observations, policy = null }) {
  if (!Array.isArray(observations) || observations.length === 0) {
    return hold(EXTERNAL_VALUATION_VALIDATION_STATUS.HOLD_EVIDENCE, ['at least one external comparison observation is required']);
  }

  if (policy === null) {
    return hold(
      EXTERNAL_VALUATION_VALIDATION_STATUS.UNRATED_POLICY_REQUIRED,
      ['caller-supplied validation policy is required; thresholds are not invented by STARTAK'],
    );
  }
  if (!validatePolicy(policy)) {
    throw new TypeError('policy must define minObservations, maxDateGapDays, maxMedianAbsolutePercentageError, and maxAbsoluteMedianSignedPercentageError');
  }

  const normalized = [];
  const evidenceFailures = [];
  const comparabilityFailures = [];

  for (const [index, item] of observations.entries()) {
    const evidenceValid =
      item &&
      nonEmptyString(item.caseId) &&
      nonEmptyString(item.projectId) &&
      finitePositive(item.startakValue) &&
      finitePositive(item.comparatorValue) &&
      Object.values(COMPARATOR_TYPE).includes(item.comparatorType) &&
      nonEmptyString(item.currency) &&
      nonEmptyString(item.basis) &&
      isDate(item.startakAsOf) &&
      isDate(item.comparatorAsOf) &&
      nonEmptyString(item.startakEvidenceRef) &&
      nonEmptyString(item.comparatorEvidenceRef) &&
      nonEmptyString(item.reviewerRef);

    if (!evidenceValid) {
      evidenceFailures.push({ index, reason: 'MISSING_OR_INVALID_EVIDENCE_METADATA' });
      continue;
    }

    if (item.startakCurrency && item.startakCurrency !== item.currency) {
      comparabilityFailures.push({ index, reason: 'STARTAK_CURRENCY_MISMATCH' });
      continue;
    }
    if (item.comparatorCurrency && item.comparatorCurrency !== item.currency) {
      comparabilityFailures.push({ index, reason: 'COMPARATOR_CURRENCY_MISMATCH' });
      continue;
    }
    if (item.startakBasis && item.startakBasis !== item.basis) {
      comparabilityFailures.push({ index, reason: 'STARTAK_BASIS_MISMATCH' });
      continue;
    }
    if (item.comparatorBasis && item.comparatorBasis !== item.basis) {
      comparabilityFailures.push({ index, reason: 'COMPARATOR_BASIS_MISMATCH' });
      continue;
    }

    const dateGapDays = Math.abs(Date.parse(item.startakAsOf) - Date.parse(item.comparatorAsOf)) / 86400000;
    if (dateGapDays > policy.maxDateGapDays) {
      comparabilityFailures.push({ index, reason: 'DATE_GAP_EXCEEDS_POLICY', dateGapDays, maxDateGapDays: policy.maxDateGapDays });
      continue;
    }

    const signedError = item.startakValue - item.comparatorValue;
    const signedPercentageError = signedError / item.comparatorValue;
    const absolutePercentageError = Math.abs(signedPercentageError);

    normalized.push({
      index,
      caseId: item.caseId.trim(),
      projectId: item.projectId.trim(),
      comparatorType: item.comparatorType,
      basis: item.basis.trim(),
      currency: item.currency.trim(),
      startakValue: item.startakValue,
      comparatorValue: item.comparatorValue,
      signedError,
      signedPercentageError,
      absolutePercentageError,
      dateGapDays,
      startakEvidenceRef: item.startakEvidenceRef.trim(),
      comparatorEvidenceRef: item.comparatorEvidenceRef.trim(),
      reviewerRef: item.reviewerRef.trim(),
    });
  }

  if (evidenceFailures.length > 0) {
    return {
      ...hold(EXTERNAL_VALUATION_VALIDATION_STATUS.HOLD_EVIDENCE, ['one or more observations lack required external-validation evidence'], normalized),
      failures: evidenceFailures,
    };
  }
  if (comparabilityFailures.length > 0) {
    return {
      ...hold(EXTERNAL_VALUATION_VALIDATION_STATUS.HOLD_COMPARABILITY, ['one or more observations are not comparable under the supplied policy'], normalized),
      failures: comparabilityFailures,
    };
  }

  if (normalized.length < policy.minObservations) {
    return hold(
      EXTERNAL_VALUATION_VALIDATION_STATUS.HOLD_MIN_SAMPLE,
      [`minimum observation count not met: required=${policy.minObservations} actual=${normalized.length}`],
      normalized,
    );
  }

  const ape = normalized.map((item) => item.absolutePercentageError);
  const signed = normalized.map((item) => item.signedPercentageError);
  const metrics = {
    observationCount: normalized.length,
    meanAbsolutePercentageError: mean(ape),
    medianAbsolutePercentageError: median(ape),
    medianSignedPercentageError: median(signed),
    maxAbsolutePercentageError: Math.max(...ape),
    comparatorTypeCounts: Object.fromEntries(Object.values(COMPARATOR_TYPE).map((type) => [type, normalized.filter((item) => item.comparatorType === type).length])),
    semantics: 'Error metrics describe the supplied comparison sample only; they are not a confidence interval or proof of future valuation accuracy.',
  };

  const passes =
    metrics.medianAbsolutePercentageError <= policy.maxMedianAbsolutePercentageError &&
    Math.abs(metrics.medianSignedPercentageError) <= policy.maxAbsoluteMedianSignedPercentageError;

  if (!passes) {
    return hold(
      EXTERNAL_VALUATION_VALIDATION_STATUS.HOLD_THRESHOLD,
      ['external valuation error metrics exceed the caller-supplied validation policy'],
      normalized,
      metrics,
    );
  }

  return {
    status: EXTERNAL_VALUATION_VALIDATION_STATUS.VALIDATED_WITHIN_POLICY,
    reasons: [],
    observations: normalized,
    metrics,
    appliedPolicy: { ...policy },
    validationPolicyPassed: true,
    certifiedValuationEstablished: false,
    productionDecisionAuthorized: false,
    humanReviewRequired: true,
    statisticalConfidenceEstablished: false,
    semantics: 'VALIDATED_WITHIN_POLICY means only that the supplied independent-appraisal/transaction comparison sample satisfies caller-supplied error and comparability thresholds. It is not a certified valuation, a statistical guarantee, or an authorization to rely on STARTAK without professional judgment.',
  };
}

module.exports = {
  COMPARATOR_TYPE,
  EXTERNAL_VALUATION_VALIDATION_STATUS,
  evaluateExternalValuationValidation,
};
