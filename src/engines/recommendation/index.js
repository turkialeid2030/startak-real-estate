'use strict';

// Financial Engine Remediation Wave A.
// A decision verdict may no longer be produced by simple criterion counting
// when an economically non-negotiable hurdle has failed.  Callers may pass
// either legacy booleans or structured criteria:
//   { code, met, hardGate }
// Legacy booleans remain supported for non-remediated callers, but the
// canonical valuation engines now use structured criteria.
function normalizeCriterion(item, index) {
  if (typeof item === 'boolean') {
    return { code: `CRITERION_${index + 1}`, met: item, hardGate: false };
  }
  if (!item || typeof item !== 'object') {
    return { code: `CRITERION_${index + 1}`, met: false, hardGate: false };
  }
  return {
    code: typeof item.code === 'string' && item.code.trim() ? item.code.trim() : `CRITERION_${index + 1}`,
    met: item.met === true,
    hardGate: item.hardGate === true,
  };
}

function tierVerdict(criteria) {
  if (!Array.isArray(criteria) || criteria.length === 0) {
    throw new TypeError('tierVerdict: criteria must be a non-empty array');
  }

  const normalized = criteria.map(normalizeCriterion);
  const total = normalized.length;
  const met = normalized.filter((item) => item.met).length;
  const failed = normalized.filter((item) => !item.met);
  const failedHardGates = failed.filter((item) => item.hardGate).map((item) => item.code);
  const failedSoftCriteria = failed.filter((item) => !item.hardGate).map((item) => item.code);

  let verdict;
  let decisionStatus;
  if (failedHardGates.length > 0) {
    verdict = 'لا يوصى بالشراء';
    decisionStatus = 'HARD_GATE_FAILED';
  } else if (failedSoftCriteria.length === 0) {
    verdict = 'يوصى بالشراء';
    decisionStatus = 'ALL_CRITERIA_MET';
  } else if (failedSoftCriteria.length === 1) {
    verdict = 'يوصى بالشراء بشروط';
    decisionStatus = 'SOFT_CONDITION_REQUIRED';
  } else {
    verdict = 'لا يوصى بالشراء';
    decisionStatus = 'MULTIPLE_SOFT_CRITERIA_FAILED';
  }

  return {
    met,
    total,
    verdict,
    decisionStatus,
    criteria: normalized,
    failedHardGates,
    failedSoftCriteria,
  };
}

module.exports = { tierVerdict };
