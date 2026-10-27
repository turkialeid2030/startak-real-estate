'use strict';

// N06/C56: fail-closed, time-forward holdout discipline layered over the
// existing external valuation arithmetic. An internally passing result is
// NOT independent evidence of a real transaction, source rights or certification.
const crypto = require('node:crypto');
const { evaluateExternalValuationValidation,
  EXTERNAL_VALUATION_VALIDATION_STATUS } = require('./external-valuation-validation');

const STATUS = Object.freeze({
  HOLD_PROTOCOL: 'HOLD_PROTOCOL',
  HOLD_COHORT: 'HOLD_COHORT',
  HOLD_EVIDENCE: 'HOLD_EVIDENCE',
  HOLD_NUMERIC: 'HOLD_NUMERIC',
  CALCULATED_WITHIN_REGISTERED_THRESHOLDS: 'CALCULATED_WITHIN_REGISTERED_THRESHOLDS',
});
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_CASES = 10000;
// Bounded preregistration metadata: synthetic or real caller-provided
// cohorts must never allocate unbounded calibration/slice collections.
const MAX_CALIBRATION_ASSETS = MAX_CASES;
const MAX_REGISTERED_SLICES = 128;
const SCOPES = new Set(['region', 'assetType']);

function validDate(value) {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return false;
  const parsed = new Date(value + 'T00:00:00.000Z');
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
function nonEmpty(v) { return typeof v === 'string' && v.trim().length > 0; }
function nonNegativeFinite(v) { return typeof v === 'number' && Number.isFinite(v) && v >= 0; }
function hold(status, reasons, details = []) {
  return {
    status, reasons, details, metrics: null, sliceMetrics: [],
    sampleMetricsWithinProtocol: false,
    independentMarketEvidenceVerified: false,
    sourceRightsVerified: false,
    licensedValuerApproved: false,
    statisticalConfidenceEstablished: false,
    certifiedValuationEstablished: false,
    productionDecisionAuthorized: false,
    humanReviewRequired: true,
  };
}
function protocolErrors(p) {
  const errors = [];
  if (!p || typeof p !== 'object' || Array.isArray(p)) return ['PROTOCOL_REQUIRED'];
  for (const k of ['protocolId','modelVersion','currency','basis']) if (!nonEmpty(p[k])) errors.push('MISSING_' + k);
  for (const k of ['registeredAt','trainingCutoffDate','holdoutStartDate','holdoutEndDate']) {
    if (!validDate(p[k])) errors.push('INVALID_' + k);
  }
  if (['registeredAt','trainingCutoffDate','holdoutStartDate','holdoutEndDate'].every(k => validDate(p[k]))) {
    if (!(p.trainingCutoffDate <= p.registeredAt && p.registeredAt < p.holdoutStartDate &&
      p.holdoutStartDate <= p.holdoutEndDate)) errors.push('TIME_FORWARD_PROTOCOL_ORDER_INVALID');
  }
  if (!nonNegativeFinite(p.maxP90AbsolutePercentageError)) errors.push('MAX_P90_THRESHOLD_REQUIRED');
  if (!Array.isArray(p.calibrationAssetIds) || p.calibrationAssetIds.length === 0) {
    errors.push('CALIBRATION_ASSET_IDS_REQUIRED_AND_UNIQUE');
  } else if (p.calibrationAssetIds.length > MAX_CALIBRATION_ASSETS) {
    errors.push('CALIBRATION_ASSET_IDS_LIMIT_EXCEEDED');
  } else if (p.calibrationAssetIds.some(x => !nonEmpty(x)) ||
      new Set(p.calibrationAssetIds).size !== p.calibrationAssetIds.length) {
    errors.push('CALIBRATION_ASSET_IDS_REQUIRED_AND_UNIQUE');
  }
  if (!Array.isArray(p.slices) || p.slices.length === 0) errors.push('REGISTERED_SLICES_REQUIRED');
  else if (p.slices.length > MAX_REGISTERED_SLICES) errors.push('REGISTERED_SLICES_LIMIT_EXCEEDED');
  else {
    const seen = new Set(), fields = new Set();
    for (const [i, s] of p.slices.entries()) {
      const key = String(s?.field) + ':' + String(s?.value);
      if (!s || !SCOPES.has(s.field) || !nonEmpty(s.value) ||
          !Number.isInteger(s.minObservations) || s.minObservations < 1 ||
          !['maxMedianAbsolutePercentageError', 'maxP90AbsolutePercentageError',
            'maxAbsoluteMedianSignedPercentageError'].every(k => nonNegativeFinite(s[k])) ||
          seen.has(key)) {
        errors.push('INVALID_OR_DUPLICATE_SLICE_' + i);
      }
      if (s && SCOPES.has(s.field)) fields.add(s.field);
      seen.add(key);
    }
    if (!fields.has('region') || !fields.has('assetType')) {
      errors.push('REGION_AND_ASSET_TYPE_SLICE_REGISTRATION_REQUIRED');
    }
  }
  const numeric = p.numericPolicy;
  if (!numeric || typeof numeric !== 'object' || Array.isArray(numeric) ||
      !Number.isInteger(numeric.minObservations) || numeric.minObservations < 1 ||
      !['maxDateGapDays','maxMedianAbsolutePercentageError',
        'maxAbsoluteMedianSignedPercentageError'].every(k => nonNegativeFinite(numeric[k]))) {
    errors.push('NUMERIC_POLICY_MISSING_OR_INVALID');
  }
  return errors;
}
function percentileNearestRank(values, fraction) {
  const sorted = [...values].sort((a,b) => a-b);
  return sorted[Math.ceil(sorted.length * fraction)-1];
}
function median(values) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a,b) => a-b);
  const m = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[m] : sorted[m-1] / 2 + sorted[m] / 2;
}
function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') return Object.keys(value).sort()
    .reduce((acc,k) => {acc[k]=stable(value[k]);return acc;}, {});
  return value;
}
function evaluateTimeForwardHoldout({ protocol, observations } = {}) {
  const invalid = protocolErrors(protocol);
  if (invalid.length) return hold(STATUS.HOLD_PROTOCOL, invalid);
  if (!Array.isArray(observations) || observations.length === 0 ||
      observations.length > MAX_CASES) {
    return hold(STATUS.HOLD_COHORT, ['SAMPLE_SIZE_MISSING_OR_EXCEEDS_BOUND']);
  }
  const failures = [], seenAssets = new Set(), seenCases = new Set(), seenComparators = new Set();
  const calibrated = new Set(protocol.calibrationAssetIds.map(x => x.trim()));
  const perRecord = [];
  for (const [index, item] of observations.entries()) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      failures.push({index, code:'INVALID_OBSERVATION'}); continue;
    }
    const keys = ['caseId','projectId','region','assetType','predictionRecordedAt','modelVersion',
      'startakEvidenceRef','comparatorEvidenceRef','reviewerRef'];
    if (keys.some(k => !nonEmpty(item[k])) ||
        !validDate(item.predictionRecordedAt) ||
        !validDate(item.startakAsOf) || !validDate(item.comparatorAsOf)) {
      failures.push({index,code:'INCOMPLETE_COHORT_EVIDENCE'}); continue;
    }
    const asset = item.projectId.trim(), id = item.caseId.trim(),
      comparator = item.comparatorEvidenceRef.trim();
    if (seenAssets.has(asset) || seenCases.has(id) || seenComparators.has(comparator) ||
        calibrated.has(asset)) failures.push({index,code:'DEPENDENT_OR_CALIBRATION_OVERLAP'});
    seenAssets.add(asset); seenCases.add(id); seenComparators.add(comparator);
    if (item.modelVersion !== protocol.modelVersion ||
        item.currency !== protocol.currency || item.basis !== protocol.basis) {
      failures.push({index,code:'MODEL_CURRENCY_OR_BASIS_MISMATCH'});
    }
    if (!(protocol.registeredAt <= item.predictionRecordedAt &&
      protocol.trainingCutoffDate <= item.startakAsOf &&
      item.startakAsOf <= item.predictionRecordedAt &&
      item.predictionRecordedAt < item.comparatorAsOf &&
      protocol.holdoutStartDate <= item.comparatorAsOf &&
      item.comparatorAsOf <= protocol.holdoutEndDate)) {
      failures.push({index,code:'LOOKAHEAD_OR_HOLDOUT_DATE_VIOLATION'});
    }
    perRecord.push(item);
  }
  if (failures.length) return hold(STATUS.HOLD_COHORT, ['COHORT_INTEGRITY_FAILED'], failures);
  // Every observed location and asset type must be explicitly in the
  // pre-registered cohort. Unregistered slices cannot be silently discarded.
  const registeredSlices = new Set(protocol.slices.map(s => s.field + ':' + s.value));
  const unregistered = perRecord.flatMap((item, index) =>
    ['region', 'assetType']
      .filter(field => !registeredSlices.has(field + ':' + item[field].trim()))
      .map(field => ({ index, field, value:item[field].trim(), code:'UNREGISTERED_COHORT_SLICE' })));
  if (unregistered.length) {
    return hold(STATUS.HOLD_COHORT, ['UNREGISTERED_COHORT_SLICE'], unregistered);
  }
  const result = evaluateExternalValuationValidation({
    observations: perRecord, policy: protocol.numericPolicy,
  });
  if (result.status !== EXTERNAL_VALUATION_VALIDATION_STATUS.VALIDATED_WITHIN_POLICY) {
    return hold(STATUS.HOLD_NUMERIC, ['BASE_EXTERNAL_VALIDATION_' + result.status],
      result.failures || result.reasons);
  }
  const errors = result.observations.map(o => o.absolutePercentageError);
  const p90 = percentileNearestRank(errors, 0.9);
  const sliceMetrics = protocol.slices.map(s => {
    const matching = result.observations.filter(o => observations[o.index][s.field].trim() === s.value);
    const absoluteErrors = matching.map(o => o.absolutePercentageError);
    const signedErrors = matching.map(o => o.signedPercentageError);
    return {
      field:s.field, value:s.value, observationCount:matching.length,
      required:s.minObservations,
      maxMedianAbsolutePercentageError:s.maxMedianAbsolutePercentageError,
      maxP90AbsolutePercentageError:s.maxP90AbsolutePercentageError,
      maxAbsoluteMedianSignedPercentageError:s.maxAbsoluteMedianSignedPercentageError,
      medianAbsolutePercentageError:median(absoluteErrors),
      p90AbsolutePercentageError:matching.length ? percentileNearestRank(absoluteErrors,0.9) : null,
      medianSignedPercentageError:median(signedErrors),
    };
  });
  const sliceFailures = sliceMetrics.filter(s => s.observationCount < s.required);
  if (sliceFailures.length) return {
    ...hold(STATUS.HOLD_COHORT, ['REGISTERED_SLICE_UNDERPOWERED'], sliceFailures),
    sliceMetrics,
  };
  const sliceBreaches = sliceMetrics.filter(s =>
    s.medianAbsolutePercentageError > s.maxMedianAbsolutePercentageError ||
    s.p90AbsolutePercentageError > s.maxP90AbsolutePercentageError ||
    Math.abs(s.medianSignedPercentageError) > s.maxAbsoluteMedianSignedPercentageError);
  if (sliceBreaches.length) {
    return {
      ...hold(STATUS.HOLD_NUMERIC, ['REGISTERED_SLICE_NUMERIC_THRESHOLD_EXCEEDED'],sliceBreaches),
      sliceMetrics,
    };
  }
  if (p90 > protocol.maxP90AbsolutePercentageError) {
    return {
      ...hold(STATUS.HOLD_NUMERIC, ['P90_OUTSIDE_REGISTERED_THRESHOLD'],
        [{actual:p90, maximum:protocol.maxP90AbsolutePercentageError}]),
      sliceMetrics,
    };
  }
  const protocolDigestSha256 = crypto.createHash('sha256')
    .update(JSON.stringify(stable(protocol))).digest('hex');
  return {
    ...hold(STATUS.CALCULATED_WITHIN_REGISTERED_THRESHOLDS, []),
    metrics: { ...result.metrics, p90AbsolutePercentageError:p90,
      // These are descriptive sample statistics, NOT a confidence interval.
      semantics:'Internal supplied-cohort diagnostics only; source authenticity and statistical representativeness remain unverified.' },
    sliceMetrics, protocolDigestSha256,
    sampleMetricsWithinProtocol:true,
    semantics:'No independent proof of protocol pre-registration, authentic completed-sale records, rights, calibration separation or licensed human approval. Do not use for autonomous or certified valuation.',
  };
}
module.exports = { STATUS, evaluateTimeForwardHoldout };
