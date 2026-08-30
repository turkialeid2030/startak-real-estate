// src/contracts/executable-investment-case.js -- central ExecutableInvestmentCase contract.
const { createCalculationVersions } = require('./calculation-versions');
const { STUDY_LEVEL } = require('./study-level');
const CRITICAL_GATES = require('../registries/critical-gate-registry.json');

function freshCriticalGates() {
  // Returns a fresh copy of the 16-gate default state -- NEVER pre-populated
  // with PASS/FAIL/CONDITIONAL. Each ExecutableInvestmentCase gets its own
  // independent copy (no shared-reference mutation risk).
  return CRITICAL_GATES.map((g) => ({ ...g }));
}

/**
 * Creates a structured ExecutableInvestmentCase from a StudyDefinition calculation.
 * Fields not currently supported by the artifact use explicit truthful states
 * (NOT_EVALUATED / PLANNED / INSUFFICIENT_EVIDENCE) -- no fabricated data.
 */
function createExecutableInvestmentCase({ caseId, studyType, inputs, engineResult, verdict }) {
  return {
    caseId,
    opportunity: { status: 'NOT_EVALUATED', items: [] }, // no opportunity-tracking concept in current artifact
    property: { status: 'NOT_EVALUATED', items: [] }, // property attributes exist as flat input fields only, not a structured object
    studyType,
    studyLevel: STUDY_LEVEL.SCREENING, // only level with real current behavior
    inputs, // the actual input object used for this calculation
    evidence: { status: 'NOT_EVALUATED', items: [] }, // no evidence-attachment concept in current artifact
    assumptions: { status: 'IMPLEMENTED', items: inputs }, // current inputs ARE the assumptions (no separate versioned assumption object exists)
    financialModel: { status: 'IMPLEMENTED', cashflows: engineResult.cashflows, irr: engineResult.irr, npv: engineResult.npv },
    valuation: { status: 'IMPLEMENTED' }, // populated by selectValuationResult -- caller merges as needed
    financing: { status: engineResult.leveredIRR !== undefined ? 'IMPLEMENTED' : 'NOT_EVALUATED' },
    scenarios: { status: 'PLANNED', items: [] }, // multi-scenario beyond single sensitivity tornado not implemented
    risks: { status: 'NOT_EVALUATED', items: [] }, // no risk-register concept in current artifact
    criticalGates: { status: 'FOUNDATION_ONLY', items: freshCriticalGates() }, // 16 gates, all NOT_EVALUATED by default -- see Section 12/13 safe-default rule
    recommendation: { status: 'IMPLEMENTED', verdict, metCount: engineResult.metCount, totalCriteria: engineResult.totalCriteria },
    decision: { status: 'NOT_EVALUATED' }, // no human-decision-capture field exists
    conditions: { status: 'PLANNED', items: [] },
    actions: { status: 'PLANNED', items: [] },
    outcomes: { status: 'PLANNED', items: [] },
    versions: createCalculationVersions(),
  };
}
module.exports = { createExecutableInvestmentCase };
