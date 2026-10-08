'use strict';

const crypto = require('node:crypto');
const {
  evaluateExternalValuationValidation,
  EXTERNAL_VALUATION_VALIDATION_STATUS,
} = require('../validation/external-valuation-validation');
const {
  evaluateExternalHistoricalReplayForGateIngestion,
  STATUS: C51_STATUS,
} = require('../replay/historical-replay-readiness');

const VERSION = 'C56_SAUDI_OUT_OF_SAMPLE_COHORT_V1';
const STATUS = Object.freeze({
  HOLD: 'HOLD_EVIDENCE_OR_PREDECLARATION',
  HOLD_PERFORMANCE: 'HOLD_INDEPENDENT_PERFORMANCE',
  READY_FOR_EXTERNAL_REVIEW: 'READY_FOR_EXTERNAL_REVIEW',
});
const SHA = /^[a-f0-9]{64}$/i;
function valid(v) {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(v)
    && Number.isFinite(Date.parse(v))
    && new Date(v).toISOString().slice(0, 10) === v.slice(0, 10);
}
function filled(v) { return typeof v === 'string' && v.trim().length > 0; }
function freeze(o) { if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.values(o).forEach(freeze); Object.freeze(o); } return o; }
function stable(v) {
  if (Array.isArray(v)) return v.map(stable);
  if (!v || typeof v !== 'object') return v;
  return Object.fromEntries(Object.keys(v).sort().map(k => [k, stable(v[k])]));
}
function fingerprint(v) { return crypto.createHash('sha256').update(JSON.stringify(stable(v))).digest('hex'); }
function hold(blockers, extra = {}) {
  return freeze({version: VERSION, status: STATUS.HOLD, blockers: [...new Set(blockers)], marketAccuracyEstablished: false,
    certifiedValuationEstablished: false, productionDecisionAuthorized: false, commercialGoLiveAuthorized: false,
    externalIndependentReviewerRequired: true, ...extra});
}
function percentile(sorted, q) {
  if (!sorted.length) return null;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos), hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}
function metrics(observations) {
  const errors = observations.map(r => (r.startakValue - r.comparatorValue) / r.comparatorValue);
  const abs = errors.map(Math.abs).sort((a, b) => a - b);
  return {
    count: errors.length,
    meanAbsolutePercentageError: errors.reduce((a, n) => a + Math.abs(n), 0) / errors.length,
    medianAbsolutePercentageError: percentile(abs, 0.5),
    p90AbsolutePercentageError: percentile(abs, 0.9),
    meanSignedPercentageError: errors.reduce((a, n) => a + n, 0) / errors.length,
  };
}
/**
 * Strict C56 readiness gate: reuses C51 historical replay external record and
 * existing comparative-error policy. No synthetic record becomes real evidence.
 * Even complete data requires independent C30 validation; this module never
 * claims market accuracy or authorizes valuation/public/commercial production.
 */
function evaluateSaudiHistoricalCohort({ replayPlan, replayRecord, asOf, registration, observations, validationPolicy } = {}) {
  const blockers = [];
  const registrationValid = registration && typeof registration === 'object'
    && valid(registration.predeclaredAt) && valid(registration.calibrationEndDate)
    && filled(registration.protocolRef) && filled(registration.registeredByRef)
    && SHA.test(registration.protocolHashSha256 || '')
    && Number.isInteger(registration.minHoldoutObservations) && registration.minHoldoutObservations >= 2
    && Number.isInteger(registration.minSliceObservations) && registration.minSliceObservations >= 1;
  if (!registrationValid) blockers.push('PREDECLARED_SPLIT_AND_METRICS_PROTOCOL_REQUIRED');
  else if (Date.parse(registration.predeclaredAt) > Date.parse(registration.calibrationEndDate)) blockers.push('CALIBRATION_CUTOFF_BEFORE_REGISTRATION');
  if (!valid(asOf)) blockers.push('INVALID_ANALYSIS_DATE');
  const rows = Array.isArray(observations) ? observations : [];
  if (!rows.length) blockers.push('REAL_SAUDI_HISTORICAL_CASES_NOT_SUPPLIED');
  if (!registrationValid || !valid(asOf)) return hold(blockers);

  const c51 = evaluateExternalHistoricalReplayForGateIngestion({replayPlan,replayRecord,asOf});
  if (c51.status !== C51_STATUS.READY_FOR_C30_GATE_INGESTION) blockers.push('C51_INDEPENDENT_HISTORICAL_REPLAY_GATE_NOT_READY');

  const seenIds = new Set();
  const seenFacts = new Set();
  const clean = [];
  for (const row of rows) {
    const id = row?.caseId;
    if (!filled(id) || !filled(row.projectId) || !filled(row.assetType)
      || !['Riyadh', 'Jeddah', 'Eastern Province', 'Other Saudi'].includes(row.city)
      || row.country !== 'SA'
      || row.synthetic !== false
      || !filled(row.comparatorEvidenceRef) || !filled(row.startakEvidenceRef)
      || !filled(row.reviewerRef) || !filled(row.propertyIdentityRef)
      || !SHA.test(row.comparatorArtifactSha256 || '')
      || !valid(row.comparatorAsOf) || !valid(row.startakAsOf) || !valid(row.modelIssuedAt)
      || !['CALIBRATION', 'HOLDOUT'].includes(row.split)
      || !Number.isFinite(row.startakValue) || row.startakValue <= 0
      || !Number.isFinite(row.comparatorValue) || row.comparatorValue <= 0
      || !filled(row.currency) || !filled(row.basis)) {
      blockers.push('INVALID_OR_SYNTHETIC_SAUDI_CASE:' + (id || 'UNKNOWN'));
      continue;
    }
    if (seenIds.has(id)) blockers.push('DUPLICATE_CASE_ID:' + id);
    seenIds.add(id);
    const identity = row.propertyIdentityRef + '|' + row.comparatorAsOf + '|' + row.comparatorEvidenceRef;
    if (seenFacts.has(identity)) blockers.push('DUPLICATE_MARKET_TRUTH:' + id);
    seenFacts.add(identity);
    if (Date.parse(row.modelIssuedAt) > Date.parse(row.comparatorAsOf)) blockers.push('FUTURE_INFORMATION_LEAKAGE:' + id);
    if (Date.parse(row.comparatorAsOf) > Date.parse(asOf)) blockers.push('FUTURE_COMPARATOR_TRUTH:' + id);
    if (row.split === 'CALIBRATION' && Date.parse(row.comparatorAsOf) > Date.parse(registration.calibrationEndDate)) {
      blockers.push('CALIBRATION_DATE_AFTER_CUTOFF:' + id);
    }
    if (row.split === 'HOLDOUT' && Date.parse(row.comparatorAsOf) <= Date.parse(registration.calibrationEndDate)) {
      blockers.push('HOLDOUT_DATE_AT_OR_BEFORE_CUTOFF:' + id);
    }
    clean.push(row);
  }
  const h = clean.filter(row => row.split === 'HOLDOUT');
  if (h.length < registration.minHoldoutObservations) blockers.push('INSUFFICIENT_SEALED_HOLDOUT_SAMPLE');
  if (!clean.some(row => row.split === 'CALIBRATION')) blockers.push('CALIBRATION_COHORT_REQUIRED');
  if (rows.length && clean.length !== rows.length) blockers.push('INCOMPLETE_CASE_SCREENING');
  if (c51.readyForC30GateIngestion && replayRecord.cases.length) {
    const known = new Set(replayRecord.cases.map(c => c.caseId));
    if (clean.some(row => !known.has(row.caseId))) blockers.push('HOLDOUT_CASE_NOT_IN_C51_REPLAY_RECORD');
  }
  if (blockers.length) return hold(blockers, {casesSupplied: rows.length, holdoutCount: h.length});

  const validate = evaluateExternalValuationValidation({observations: h, policy: validationPolicy});
  const segments = {};
  const groups = new Map();
  for (const row of h) {
    const key = row.city + '|' + row.assetType;
    groups.set(key, [...(groups.get(key) || []), row]);
  }
  for (const [key, records] of groups) {
    segments[key] = {
      ...metrics(records),
      insufficientSliceSize: records.length < registration.minSliceObservations,
    };
  }
  const overall = metrics(h);
  const performanceHold = validate.status !== EXTERNAL_VALUATION_VALIDATION_STATUS.VALIDATED_WITHIN_POLICY;
  const sliceHold = Object.values(segments).some(s => s.insufficientSliceSize);
  const status = performanceHold || sliceHold ? STATUS.HOLD_PERFORMANCE : STATUS.READY_FOR_EXTERNAL_REVIEW;
  return freeze({
    version: VERSION,
    status,
    blockers: [...(performanceHold ? ['INDEPENDENT_VALIDATION_POLICY_NOT_SATISFIED'] : []),
      ...(sliceHold ? ['INSUFFICIENT_SEGMENT_SAMPLE'] : [])],
    registrationHashSha256: fingerprint(registration),
    candidateHeadSha: replayPlan.candidateHeadSha,
    observationsHashSha256: fingerprint(clean),
    calibrationCount: clean.length - h.length,
    holdoutCount: h.length,
    overall,
    byCityAndAssetType: segments,
    existingValidatorStatus: validate.status,
    independentMarketProofAuthenticityNotEstablishedByStructuralChecks: true,
    readyForC30ExternalGateSubmission: status === STATUS.READY_FOR_EXTERNAL_REVIEW,
    marketAccuracyEstablished: false,
    certifiedValuationEstablished: false,
    productionDecisionAuthorized: false,
    commercialGoLiveAuthorized: false,
    externalIndependentReviewerRequired: true,
    semantics: 'C56 computes held-out historical error metrics only on records passing strict temporal and source-metadata checks. Self-declared non-synthetic flags and signed source references must be authenticated externally. READY_FOR_EXTERNAL_REVIEW is not proof of market accuracy, certification or deployment authority.',
  });
}
module.exports = {VERSION, STATUS, evaluateSaudiHistoricalCohort};
