'use strict';

// src/contracts/executable-investment-case.js -- central ExecutableInvestmentCase contract.
const { createCalculationVersions } = require('./calculation-versions');
const { STUDY_LEVEL } = require('./study-level');
const CRITICAL_GATES = require('../registries/critical-gate-registry.json');

const EXECUTABLE_CASE_SCHEMA_VERSION = 2;

// Canonical lifecycle sections required by the Startak Real Estate master directive.
// A section being present here does NOT mean it is professionally complete. The
// section status remains the authoritative statement of what has actually been
// evaluated for the case.
const LIFECYCLE_SECTIONS = Object.freeze([
  'assignment',
  'scope',
  'documents',
  'inspection',
  'market',
  'hbu',
  'valuation',
  'development',
  'finance',
  'reconciliation',
  'uncertainty',
  'review',
  'reporting',
  'scenarios',
  'risks',
  'investmentCommittee',
  'governance',
]);

function freshCriticalGates() {
  // Returns a fresh copy of the gate default state -- NEVER pre-populated
  // with PASS/FAIL/CONDITIONAL. Each ExecutableInvestmentCase gets its own
  // independent copy (no shared-reference mutation risk).
  return CRITICAL_GATES.map((g) => ({ ...g }));
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

/**
 * Normalize a supplied domain output without inventing professional completion.
 * - Explicit status from the producing module always wins.
 * - A supplied object/array without a status is marked IMPLEMENTED only to mean
 *   "data was supplied to this case contract"; no conformance/licensing claim is
 *   created by this helper.
 * - Missing values use the caller-provided truthful fallback.
 */
function normalizeSection(value, fallback) {
  if (value === undefined || value === null) return { ...fallback };
  if (Array.isArray(value)) return { status: 'IMPLEMENTED', items: value.slice() };
  if (typeof value === 'object') {
    return hasOwn(value, 'status') ? { ...value } : { status: 'IMPLEMENTED', ...value };
  }
  return { status: 'IMPLEMENTED', value };
}

function fallbackLifecycleSections() {
  return {
    assignment: { status: 'NOT_EVALUATED' },
    scope: { status: 'NOT_EVALUATED' },
    documents: { status: 'NOT_EVALUATED', items: [] },
    inspection: { status: 'NOT_EVALUATED', items: [] },
    market: { status: 'NOT_EVALUATED', items: [] },
    hbu: { status: 'NOT_EVALUATED' },
    development: { status: 'NOT_EVALUATED' },
    finance: { status: 'NOT_EVALUATED' },
    reconciliation: { status: 'NOT_EVALUATED' },
    uncertainty: { status: 'NOT_EVALUATED' },
    review: { status: 'NOT_EVALUATED' },
    reporting: { status: 'NOT_EVALUATED' },
    investmentCommittee: { status: 'NOT_EVALUATED' },
    governance: { status: 'NOT_EVALUATED' },
  };
}

function createLifecycleCoverage(caseSections) {
  const statuses = {};
  const evaluated = [];
  const unresolved = [];

  for (const key of LIFECYCLE_SECTIONS) {
    const status = caseSections[key] && caseSections[key].status
      ? caseSections[key].status
      : 'NOT_EVALUATED';
    statuses[key] = status;
    if (status === 'NOT_EVALUATED' || status === 'PLANNED' || status === 'FOUNDATION_ONLY') {
      unresolved.push(key);
    } else {
      evaluated.push(key);
    }
  }

  return {
    status: unresolved.length === 0 ? 'LIFECYCLE_SECTIONS_SUPPLIED' : 'LIFECYCLE_GAPS_REMAIN',
    evaluated,
    unresolved,
    statuses,
    // This is a structural completeness indicator only. It is deliberately not
    // a professional, legal, standards-conformance, release, or transaction flag.
    professionalConformanceEstablished: false,
    releaseAuthorized: false,
    transactionAuthorized: false,
  };
}

/**
 * Creates the central ExecutableInvestmentCase.
 *
 * `domainOutputs` is the controlled bridge from the post-Rebase domain modules
 * into the canonical case contract. It prevents newer modules (inspection,
 * market, HBU, reporting, governance, etc.) from existing beside the case model
 * without being representable in it.
 *
 * Backward compatibility: callers that only provide the original six arguments
 * retain the original screening/financial/recommendation behavior, while the
 * newly-required lifecycle sections remain explicitly NOT_EVALUATED.
 */
function createExecutableInvestmentCase({
  caseId,
  studyType,
  inputs,
  engineResult,
  verdict,
  domainOutputs = {},
  standardsContext = null,
}) {
  if (!domainOutputs || typeof domainOutputs !== 'object' || Array.isArray(domainOutputs)) {
    throw new TypeError('domainOutputs must be an object');
  }

  const lifecycleFallbacks = fallbackLifecycleSections();
  const caseSections = {
    opportunity: normalizeSection(domainOutputs.opportunity, { status: 'NOT_EVALUATED', items: [] }),
    property: normalizeSection(domainOutputs.property, { status: 'NOT_EVALUATED', items: [] }),

    assignment: normalizeSection(domainOutputs.assignment, lifecycleFallbacks.assignment),
    scope: normalizeSection(domainOutputs.scope, lifecycleFallbacks.scope),
    documents: normalizeSection(domainOutputs.documents, lifecycleFallbacks.documents),
    inspection: normalizeSection(domainOutputs.inspection, lifecycleFallbacks.inspection),
    market: normalizeSection(domainOutputs.market, lifecycleFallbacks.market),
    hbu: normalizeSection(domainOutputs.hbu, lifecycleFallbacks.hbu),

    evidence: normalizeSection(domainOutputs.evidence, { status: 'NOT_EVALUATED', items: [] }),
    assumptions: normalizeSection(
      domainOutputs.assumptions,
      { status: 'IMPLEMENTED', items: inputs },
    ),
    financialModel: normalizeSection(
      domainOutputs.financialModel,
      {
        status: 'IMPLEMENTED',
        cashflows: engineResult.cashflows,
        irr: engineResult.irr,
        npv: engineResult.npv,
      },
    ),

    // Preserve the Rebase caller contract: legacy callers may enrich valuation
    // immediately after creation. New callers should supply domainOutputs.valuation
    // so the actual valuation-module status and payload are retained here.
    valuation: normalizeSection(domainOutputs.valuation, { status: 'IMPLEMENTED' }),
    development: normalizeSection(domainOutputs.development, lifecycleFallbacks.development),
    finance: normalizeSection(domainOutputs.finance, lifecycleFallbacks.finance),
    financing: normalizeSection(
      domainOutputs.financing,
      { status: engineResult.leveredIRR !== undefined ? 'IMPLEMENTED' : 'NOT_EVALUATED' },
    ),
    reconciliation: normalizeSection(domainOutputs.reconciliation, lifecycleFallbacks.reconciliation),
    uncertainty: normalizeSection(domainOutputs.uncertainty, lifecycleFallbacks.uncertainty),
    review: normalizeSection(domainOutputs.review, lifecycleFallbacks.review),
    reporting: normalizeSection(domainOutputs.reporting, lifecycleFallbacks.reporting),
    scenarios: normalizeSection(domainOutputs.scenarios, { status: 'PLANNED', items: [] }),
    risks: normalizeSection(domainOutputs.risks, { status: 'NOT_EVALUATED', items: [] }),
    investmentCommittee: normalizeSection(
      domainOutputs.investmentCommittee,
      lifecycleFallbacks.investmentCommittee,
    ),
    governance: normalizeSection(domainOutputs.governance, lifecycleFallbacks.governance),

    recommendation: normalizeSection(
      domainOutputs.recommendation,
      {
        status: 'IMPLEMENTED',
        verdict,
        metCount: engineResult.metCount,
        totalCriteria: engineResult.totalCriteria,
      },
    ),
    decision: normalizeSection(domainOutputs.decision, { status: 'NOT_EVALUATED' }),
    conditions: normalizeSection(domainOutputs.conditions, { status: 'PLANNED', items: [] }),
    actions: normalizeSection(domainOutputs.actions, { status: 'PLANNED', items: [] }),
    outcomes: normalizeSection(domainOutputs.outcomes, { status: 'PLANNED', items: [] }),
  };

  return {
    schemaVersion: EXECUTABLE_CASE_SCHEMA_VERSION,
    caseId,
    studyType,
    studyLevel: domainOutputs.studyLevel || STUDY_LEVEL.SCREENING,
    inputs,
    ...caseSections,
    analyticalPackage: domainOutputs.analyticalPackage || null,
    standardsContext: standardsContext ? { ...standardsContext } : null,
    criticalGates: normalizeSection(
      domainOutputs.criticalGates,
      { status: 'FOUNDATION_ONLY', items: freshCriticalGates() },
    ),
    lifecycleCoverage: createLifecycleCoverage(caseSections),
    versions: normalizeSection(domainOutputs.versions, createCalculationVersions()),
    authority: {
      operatingMode: 'UNLICENSED_DECISION_SUPPORT',
      certifiedValuationAuthorityEstablished: false,
      professionalReportExternalIssuanceAuthorized: false,
      releaseAuthorized: false,
      mergeAuthorized: false,
      deploymentAuthorized: false,
      transactionAuthorized: false,
      ...(domainOutputs.authority && typeof domainOutputs.authority === 'object'
        ? Object.fromEntries(
            Object.entries(domainOutputs.authority).filter(([key]) => ![
              'certifiedValuationAuthorityEstablished',
              'professionalReportExternalIssuanceAuthorized',
              'releaseAuthorized',
              'mergeAuthorized',
              'deploymentAuthorized',
              'transactionAuthorized',
            ].includes(key)),
          )
        : {}),
    },
  };
}

module.exports = {
  EXECUTABLE_CASE_SCHEMA_VERSION,
  LIFECYCLE_SECTIONS,
  createExecutableInvestmentCase,
};
