'use strict';

const crypto = require('crypto');

const PERFORMANCE_QUALIFICATION_STATUS = Object.freeze({
  READY_FOR_INDEPENDENT_RELEASE_QUALIFICATION: 'READY_FOR_INDEPENDENT_RELEASE_QUALIFICATION',
  HOLD_MISSING_EVIDENCE: 'HOLD_MISSING_EVIDENCE',
  HOLD_SCOPE_MISMATCH: 'HOLD_SCOPE_MISMATCH',
  HOLD_THRESHOLD_BREACH: 'HOLD_THRESHOLD_BREACH',
  HOLD_STALE_EVIDENCE: 'HOLD_STALE_EVIDENCE',
  HOLD_INTEGRITY: 'HOLD_INTEGRITY',
});

const PERFORMANCE_EVIDENCE_CLASS = Object.freeze({
  LATENCY: 'LATENCY',
  THROUGHPUT: 'THROUGHPUT',
  ERROR_RATE: 'ERROR_RATE',
  RESOURCE_UTILIZATION: 'RESOURCE_UTILIZATION',
  RECOVERY: 'RECOVERY',
  CONCURRENCY: 'CONCURRENCY',
});

function req(v, f) { if (typeof v !== 'string' || !v.trim()) throw new TypeError(`${f} must be a non-empty string`); return v.trim(); }
function ts(v, f) { const s = req(v, f); const m = Date.parse(s); if (!Number.isFinite(m)) throw new TypeError(`${f} must be a timestamp`); return { s, m }; }
function canon(v) { if (Array.isArray(v)) return v.map(canon); if (v && typeof v === 'object') return Object.keys(v).sort().reduce((a,k)=>{a[k]=canon(v[k]);return a;},{}); return v; }
function hash(v) { return crypto.createHash('sha256').update(JSON.stringify(canon(v))).digest('hex'); }
function isHash(v) { return typeof v === 'string' && /^[a-f0-9]{64}$/i.test(v); }

function createPerformanceEvidence(input = {}) {
  if (!Object.values(PERFORMANCE_EVIDENCE_CLASS).includes(input.evidenceClass)) throw new TypeError('evidenceClass is invalid');
  if (!Number.isFinite(input.observedValue)) throw new TypeError('observedValue must be finite');
  if (!Number.isFinite(input.thresholdValue)) throw new TypeError('thresholdValue must be finite');
  if (!['MAX','MIN'].includes(input.thresholdDirection)) throw new TypeError('thresholdDirection must be MAX or MIN');
  const observedAt = ts(input.observedAt, 'observedAt');
  const reviewedAt = ts(input.reviewedAt, 'reviewedAt');
  if (reviewedAt.m < observedAt.m) throw new TypeError('reviewedAt must not precede observedAt');
  const commit = req(input.exactCommitSha, 'exactCommitSha');
  if (!/^[a-f0-9]{40}$/i.test(commit)) throw new TypeError('exactCommitSha must be 40 hex characters');
  const artifactHash = req(input.artifactHashSha256, 'artifactHashSha256');
  if (!isHash(artifactHash)) throw new TypeError('artifactHashSha256 must be SHA-256');
  const pass = input.thresholdDirection === 'MAX' ? input.observedValue <= input.thresholdValue : input.observedValue >= input.thresholdValue;
  const payload = {
    evidenceId: req(input.evidenceId, 'evidenceId'), evidenceClass: input.evidenceClass,
    environmentRef: req(input.environmentRef, 'environmentRef'), exactCommitSha: commit,
    metricName: req(input.metricName, 'metricName'), unit: req(input.unit, 'unit'),
    observedValue: input.observedValue, thresholdValue: input.thresholdValue, thresholdDirection: input.thresholdDirection,
    thresholdSourceRef: req(input.thresholdSourceRef, 'thresholdSourceRef'), pass,
    artifactId: req(input.artifactId, 'artifactId'), artifactHashSha256: artifactHash.toLowerCase(),
    observedAt: observedAt.s, reviewedAt: reviewedAt.s, reviewerRef: req(input.reviewerRef, 'reviewerRef'),
  };
  return Object.freeze({ ...payload, evidenceHashSha256: hash(payload) });
}

function verifyPerformanceEvidence(e) {
  if (!e || typeof e !== 'object') return Object.freeze({ valid:false, reason:'EVIDENCE_REQUIRED' });
  const { evidenceHashSha256, ...payload } = e;
  const expected = hash(payload);
  return Object.freeze({ valid: isHash(evidenceHashSha256) && expected === evidenceHashSha256, reason: expected === evidenceHashSha256 ? null : 'HASH_MISMATCH' });
}

function buildPerformanceResilienceQualification({ qualificationId, environmentRef, exactCommitSha, requiredEvidenceClasses, evidence, maximumEvidenceAgeSeconds, assessedAt, preparedBy, reviewedBy } = {}) {
  const env = req(environmentRef, 'environmentRef');
  const commit = req(exactCommitSha, 'exactCommitSha');
  if (!/^[a-f0-9]{40}$/i.test(commit)) throw new TypeError('exactCommitSha must be 40 hex characters');
  if (!Array.isArray(requiredEvidenceClasses) || !requiredEvidenceClasses.length) throw new TypeError('requiredEvidenceClasses must be non-empty');
  if (!Array.isArray(evidence) || !evidence.length) throw new TypeError('evidence must be non-empty');
  if (!Number.isFinite(maximumEvidenceAgeSeconds) || maximumEvidenceAgeSeconds < 0) throw new TypeError('maximumEvidenceAgeSeconds invalid');
  const assessed = ts(assessedAt, 'assessedAt');
  const required = [...new Set(requiredEvidenceClasses)];
  let status = PERFORMANCE_QUALIFICATION_STATUS.READY_FOR_INDEPENDENT_RELEASE_QUALIFICATION;
  const reasonCodes = [];
  const byClass = new Map();
  for (const item of evidence) {
    if (byClass.has(item.evidenceClass)) { status = PERFORMANCE_QUALIFICATION_STATUS.HOLD_MISSING_EVIDENCE; reasonCodes.push(`DUPLICATE:${item.evidenceClass}`); }
    else byClass.set(item.evidenceClass, item);
  }
  const missing = required.filter((c)=>!byClass.has(c));
  if (missing.length && status === PERFORMANCE_QUALIFICATION_STATUS.READY_FOR_INDEPENDENT_RELEASE_QUALIFICATION) { status = PERFORMANCE_QUALIFICATION_STATUS.HOLD_MISSING_EVIDENCE; reasonCodes.push(...missing.map(c=>`MISSING:${c}`)); }
  if (status === PERFORMANCE_QUALIFICATION_STATUS.READY_FOR_INDEPENDENT_RELEASE_QUALIFICATION) {
    for (const cls of required) {
      const item = byClass.get(cls);
      if (!verifyPerformanceEvidence(item).valid) { status = PERFORMANCE_QUALIFICATION_STATUS.HOLD_INTEGRITY; reasonCodes.push(`INTEGRITY:${cls}`); break; }
      if (item.environmentRef !== env || item.exactCommitSha !== commit) { status = PERFORMANCE_QUALIFICATION_STATUS.HOLD_SCOPE_MISMATCH; reasonCodes.push(`SCOPE:${cls}`); break; }
      const reviewed = ts(item.reviewedAt, `reviewedAt:${cls}`);
      if (reviewed.m > assessed.m || (assessed.m-reviewed.m)/1000 > maximumEvidenceAgeSeconds) { status = PERFORMANCE_QUALIFICATION_STATUS.HOLD_STALE_EVIDENCE; reasonCodes.push(`STALE:${cls}`); break; }
      if (!item.pass) { status = PERFORMANCE_QUALIFICATION_STATUS.HOLD_THRESHOLD_BREACH; reasonCodes.push(`THRESHOLD:${cls}`); break; }
    }
  }
  const payload = {
    qualificationId:req(qualificationId,'qualificationId'), status, reasonCodes, environmentRef:env, exactCommitSha:commit,
    requiredEvidenceClasses:required, evidenceHashesSha256:required.map(c=>byClass.get(c)?.evidenceHashSha256||null), maximumEvidenceAgeSeconds,
    assessedAt:assessed.s, preparedBy:req(preparedBy,'preparedBy'), reviewedBy:req(reviewedBy,'reviewedBy'),
    productionCapacityEstablished:false, productionSlaEstablished:false, disasterRecoveryCertified:false, externalLoadTestEstablished:false,
    independentReleaseQualificationRequired:true, mergeAuthorized:false, deploymentAuthorized:false, transactionAuthorized:false,
  };
  return Object.freeze({ ...payload, reasonCodes:Object.freeze(reasonCodes), requiredEvidenceClasses:Object.freeze(required), evidenceHashesSha256:Object.freeze(payload.evidenceHashesSha256), qualificationHashSha256:hash(payload), semantics:'READY_FOR_INDEPENDENT_RELEASE_QUALIFICATION means only that caller-supplied performance/resilience evidence met caller-supplied thresholds for the declared environment and exact commit. It does not establish production capacity, SLA, disaster-recovery certification, merge authority, or deployment authority.' });
}

function verifyPerformanceResilienceQualification(q) {
  if (!q || typeof q !== 'object') return Object.freeze({valid:false,reason:'QUALIFICATION_REQUIRED'});
  const { qualificationHashSha256, semantics, ...payload } = q;
  const expected = hash(payload);
  return Object.freeze({ valid:isHash(qualificationHashSha256) && expected===qualificationHashSha256, reason:expected===qualificationHashSha256?null:'HASH_MISMATCH' });
}

module.exports = { PERFORMANCE_QUALIFICATION_STATUS, PERFORMANCE_EVIDENCE_CLASS, createPerformanceEvidence, verifyPerformanceEvidence, buildPerformanceResilienceQualification, verifyPerformanceResilienceQualification };
