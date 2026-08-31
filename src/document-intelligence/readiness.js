'use strict';

const {
  RECONCILIATION_STATUS,
  READINESS_STATUS,
  TRUTH_STATUS,
  deepFreeze,
} = require('./contracts');

function normalizeRequirement(requirement) {
  if (!requirement || typeof requirement !== 'object') throw new TypeError('requirement must be an object');
  if (typeof requirement.key !== 'string' || requirement.key.trim() === '') {
    throw new TypeError('requirement.key must be a non-empty string');
  }
  const minimumIndependentSources = requirement.minimumIndependentSources === undefined
    ? 1
    : requirement.minimumIndependentSources;
  if (!Number.isInteger(minimumIndependentSources) || minimumIndependentSources < 1) {
    throw new TypeError('minimumIndependentSources must be an integer >= 1');
  }
  return {
    key: requirement.key,
    minimumIndependentSources,
    allowConflict: Boolean(requirement.allowConflict),
    allowUnitMismatch: Boolean(requirement.allowUnitMismatch),
    requireVerifiedFact: Boolean(requirement.requireVerifiedFact),
  };
}

function assessDecisionReadiness({ reconciliations, requirements }) {
  if (!Array.isArray(reconciliations)) throw new TypeError('reconciliations must be an array');
  if (!Array.isArray(requirements)) throw new TypeError('requirements must be an array');

  const byKey = new Map(reconciliations.map((item) => [item.key, item]));
  const blockers = [];
  const checks = [];

  for (const rawRequirement of requirements) {
    const requirement = normalizeRequirement(rawRequirement);
    const reconciliation = byKey.get(requirement.key) || {
      key: requirement.key,
      status: RECONCILIATION_STATUS.MISSING,
      independentSourceCount: 0,
      evidence: [],
    };
    const localBlockers = [];

    if (reconciliation.status === RECONCILIATION_STATUS.MISSING) {
      localBlockers.push('REQUIRED_EVIDENCE_MISSING');
    }
    if (reconciliation.status === RECONCILIATION_STATUS.CONFLICT && !requirement.allowConflict) {
      localBlockers.push('UNRESOLVED_CONFLICT');
    }
    if (reconciliation.status === RECONCILIATION_STATUS.UNIT_MISMATCH && !requirement.allowUnitMismatch) {
      localBlockers.push('UNIT_MISMATCH');
    }
    if ((reconciliation.independentSourceCount || 0) < requirement.minimumIndependentSources) {
      localBlockers.push('INSUFFICIENT_CORROBORATION');
    }
    if (requirement.requireVerifiedFact) {
      const hasVerifiedFact = (reconciliation.evidence || []).some((item) => item.truthStatus === TRUTH_STATUS.VERIFIED_FACT);
      if (!hasVerifiedFact) localBlockers.push('VERIFIED_FACT_REQUIRED');
    }

    const uniqueLocalBlockers = [...new Set(localBlockers)];
    for (const code of uniqueLocalBlockers) blockers.push({ key: requirement.key, code });
    checks.push({
      key: requirement.key,
      status: uniqueLocalBlockers.length ? 'BLOCKED' : 'SATISFIED',
      reconciliationStatus: reconciliation.status,
      independentSourceCount: reconciliation.independentSourceCount || 0,
      blockers: uniqueLocalBlockers,
    });
  }

  const uniqueBlockers = [];
  const seen = new Set();
  for (const blocker of blockers) {
    const signature = `${blocker.key}:${blocker.code}`;
    if (seen.has(signature)) continue;
    seen.add(signature);
    uniqueBlockers.push(blocker);
  }

  return deepFreeze({
    status: uniqueBlockers.length
      ? READINESS_STATUS.HOLD_EVIDENCE
      : READINESS_STATUS.READY_FOR_UNDERWRITING_INPUT,
    blockers: uniqueBlockers,
    checks,
    semantics: 'This gate evaluates evidence readiness only. It is not an investment recommendation, approval, or IC decision.',
  });
}

module.exports = { assessDecisionReadiness };
