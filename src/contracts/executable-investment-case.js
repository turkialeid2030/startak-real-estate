'use strict';

// src/contracts/executable-investment-case.js -- central ExecutableInvestmentCase contract.
const { createCalculationVersions } = require('./calculation-versions');
const { STUDY_LEVEL } = require('./study-level');
const CRITICAL_GATES = require('../registries/critical-gate-registry.json');

const EXECUTABLE_CASE_SCHEMA_VERSION = 2;

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

const FAIL_CLOSED_AUTHORITY = Object.freeze({
  operatingMode: 'UNLICENSED_DECISION_SUPPORT',
  formalStandardsConformanceEstablished: false,
  officialStandardsSourceVerificationComplete: false,
  saudiProfessionalLicensingEstablished: false,
  saudiLegalReviewComplete: false,
  pdplComplianceEstablished: false,
  productionSecurityValidated: false,
  productionPerformanceValidated: false,
  productionResilienceValidated: false,
  reviewerCredentialsVerified: false,
  reviewerIndependenceVerified: false,
  certifiedValuationAuthorityEstablished: false,
  professionalReportExternalIssuanceAuthorized: false,
  releaseAuthorized: false,
  mergeAuthorized: false,
  deploymentAuthorized: false,
  transactionAuthorized: false,
  humanReleaseAuthorityApprovalRequired: true,
});

function freshCriticalGates() {
  return CRITICAL_GATES.map((g) => ({ ...g }));
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

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
    professionalConformanceEstablished: false,
    releaseAuthorized: false,
    transactionAuthorized: false,
  };
}

function createAuthorityMetadata(candidate) {
  const protectedKeys = new Set(Object.keys(FAIL_CLOSED_AUTHORITY));
  const nonAuthorityMetadata = candidate && typeof candidate === 'object' && !Array.isArray(candidate)
    ? Object.fromEntries(Object.entries(candidate).filter(([key]) => !protectedKeys.has(key)))
    : {};
  return { ...nonAuthorityMetadata, ...FAIL_CLOSED_AUTHORITY };
}

/**
 * Creates the central ExecutableInvestmentCase.
 *
 * `domainOutputs` is the controlled bridge from the post-Rebase domain modules
 * into the canonical case contract. Missing lifecycle stages remain explicitly
 * NOT_EVALUATED / PLANNED; no professional or release authority is inferred.
 *
 * `projectId` and `projectProfile` are optional for backward compatibility. The
 * canonical project-model orchestrator supplies both so cross-project identity
 * is retained in the authoritative assembled case.
 */
function createExecutableInvestmentCase({
  projectId = null,
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
  if (projectId !== null && (typeof projectId !== 'string' || projectId.trim() === '')) {
    throw new TypeError('projectId must be a non-empty string or null');
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
    assumptions: normalizeSection(domainOutputs.assumptions, { status: 'IMPLEMENTED', items: inputs }),
    financialModel: normalizeSection(domainOutputs.financialModel, {
      status: 'IMPLEMENTED',
      cashflows: engineResult.cashflows,
      irr: engineResult.irr,
      npv: engineResult.npv,
    }),

    // Legacy callers enrich valuation immediately after creation. New callers
    // should supply domainOutputs.valuation to retain actual module status/payload.
    valuation: normalizeSection(domainOutputs.valuation, { status: 'IMPLEMENTED' }),
    development: normalizeSection(domainOutputs.development, lifecycleFallbacks.development),
    finance: normalizeSection(domainOutputs.finance, lifecycleFallbacks.finance),
    financing: normalizeSection(domainOutputs.financing, {
      status: engineResult.leveredIRR !== undefined ? 'IMPLEMENTED' : 'NOT_EVALUATED',
    }),
    reconciliation: normalizeSection(domainOutputs.reconciliation, lifecycleFallbacks.reconciliation),
    uncertainty: normalizeSection(domainOutputs.uncertainty, lifecycleFallbacks.uncertainty),
    review: normalizeSection(domainOutputs.review, lifecycleFallbacks.review),
    reporting: normalizeSection(domainOutputs.reporting, lifecycleFallbacks.reporting),
    scenarios: normalizeSection(domainOutputs.scenarios, { status: 'PLANNED', items: [] }),
    risks: normalizeSection(domainOutputs.risks, { status: 'NOT_EVALUATED', items: [] }),
    investmentCommittee: normalizeSection(domainOutputs.investmentCommittee, lifecycleFallbacks.investmentCommittee),
    governance: normalizeSection(domainOutputs.governance, lifecycleFallbacks.governance),

    recommendation: normalizeSection(domainOutputs.recommendation, {
      status: 'IMPLEMENTED',
      verdict,
      metCount: engineResult.metCount,
      totalCriteria: engineResult.totalCriteria,
    }),
    decision: normalizeSection(domainOutputs.decision, { status: 'NOT_EVALUATED' }),
    conditions: normalizeSection(domainOutputs.conditions, { status: 'PLANNED', items: [] }),
    actions: normalizeSection(domainOutputs.actions, { status: 'PLANNED', items: [] }),
    outcomes: normalizeSection(domainOutputs.outcomes, { status: 'PLANNED', items: [] }),
  };

  const versions = domainOutputs.versions && typeof domainOutputs.versions === 'object' && !Array.isArray(domainOutputs.versions)
    ? { ...createCalculationVersions(), ...domainOutputs.versions }
    : createCalculationVersions();

  return {
    schemaVersion: EXECUTABLE_CASE_SCHEMA_VERSION,
    projectId: projectId === null ? null : projectId.trim(),
    caseId,
    studyType,
    studyLevel: domainOutputs.studyLevel || STUDY_LEVEL.SCREENING,
    projectProfile: domainOutputs.projectProfile && typeof domainOutputs.projectProfile === 'object'
      ? { ...domainOutputs.projectProfile }
      : null,
    inputs,
    ...caseSections,
    analyticalPackage: domainOutputs.analyticalPackage || null,
    standardsContext: standardsContext ? { ...standardsContext } : null,
    criticalGates: normalizeSection(
      domainOutputs.criticalGates,
      { status: 'FOUNDATION_ONLY', items: freshCriticalGates() },
    ),
    lifecycleCoverage: createLifecycleCoverage(caseSections),
    versions,
    authority: createAuthorityMetadata(domainOutputs.authority),
  };
}

module.exports = {
  EXECUTABLE_CASE_SCHEMA_VERSION,
  LIFECYCLE_SECTIONS,
  FAIL_CLOSED_AUTHORITY,
  createExecutableInvestmentCase,
};
