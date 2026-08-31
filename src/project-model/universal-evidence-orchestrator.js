'use strict';

const {
  mapSemanticEvidence,
  reconcileSemanticEvidence,
  assessDecisionReadiness,
} = require('../document-intelligence');
const { buildEvidenceDomainPlan } = require('./evidence-plan');
const { resolveExecutableEngine } = require('./engine-router');
const { assessSemanticRuleCoverage } = require('./semantic-coverage');

const ORCHESTRATION_STATUS = Object.freeze({
  PROCESSED: 'PROCESSED',
  NO_SEMANTIC_EVIDENCE: 'NO_SEMANTIC_EVIDENCE',
  PARTIAL_PARSER_OR_MAPPING_HOLD: 'PARTIAL_PARSER_OR_MAPPING_HOLD',
});

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) freeze(child);
  return value;
}

function requireNonEmpty(value, field) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${field} must be a non-empty string`);
  return value.trim();
}

function validateBundle(bundle, caseId) {
  if (!bundle || typeof bundle !== 'object') throw new TypeError('parsed document bundle must be an object');
  const { document, parserResult } = bundle;
  if (!document || !parserResult) throw new TypeError('parsed document bundle requires document and parserResult');
  if (document.caseId !== caseId || parserResult.caseId !== caseId) {
    throw new TypeError(`CASE_ISOLATION_VIOLATION: parsed document bundle does not belong to ${caseId}`);
  }
  if (document.documentId !== parserResult.documentId) {
    throw new TypeError('CASE_OR_DOCUMENT_ISOLATION_VIOLATION: parser result documentId mismatch');
  }
  return bundle;
}

function normalizeRequirements(requirements) {
  if (!Array.isArray(requirements)) throw new TypeError('semanticRequirements must be an array');
  return requirements.map((requirement) => {
    if (!requirement || typeof requirement !== 'object') throw new TypeError('semantic requirement must be an object');
    requireNonEmpty(requirement.key, 'semanticRequirement.key');
    return { ...requirement };
  });
}

function orchestrateProjectEvidence({
  profile,
  caseId,
  parsedDocuments = [],
  semanticRequirements = [],
  capturedAt,
}) {
  if (!profile || typeof profile !== 'object' || !profile.projectId || !profile.traits) {
    throw new TypeError('qualified project profile is required');
  }
  const isolatedCaseId = requireNonEmpty(caseId, 'caseId');
  if (!Array.isArray(parsedDocuments)) throw new TypeError('parsedDocuments must be an array');
  const requirements = normalizeRequirements(semanticRequirements);

  const evidenceDomainPlan = buildEvidenceDomainPlan(profile);
  const semanticRuleCoverage = assessSemanticRuleCoverage(profile);
  const engineRoute = resolveExecutableEngine(profile);

  const mappings = [];
  const facts = [];
  for (const rawBundle of parsedDocuments) {
    const bundle = validateBundle(rawBundle, isolatedCaseId);
    const mapping = mapSemanticEvidence({
      document: bundle.document,
      parserResult: bundle.parserResult,
      capturedAt,
    });
    mappings.push(mapping);
    for (const fact of mapping.facts || []) facts.push(fact);
  }

  const reconciliationKeys = [...new Set([
    ...facts.map((fact) => fact.key),
    ...requirements.map((requirement) => requirement.key),
  ])];
  const reconciliations = reconcileSemanticEvidence(facts, {
    caseId: isolatedCaseId,
    keys: reconciliationKeys,
  });

  const readiness = requirements.length
    ? assessDecisionReadiness({ caseId: isolatedCaseId, reconciliations, requirements })
    : freeze({
      caseId: isolatedCaseId,
      status: 'NOT_EVALUATED_NO_SEMANTIC_REQUIREMENTS',
      blockers: [],
      checks: [],
      semantics: 'Evidence readiness was not evaluated because no explicit semantic requirements were supplied.',
    });

  const mappingRejected = mappings.some((mapping) => mapping.status === 'REJECTED');
  const orchestrationStatus = mappingRejected
    ? ORCHESTRATION_STATUS.PARTIAL_PARSER_OR_MAPPING_HOLD
    : facts.length
      ? ORCHESTRATION_STATUS.PROCESSED
      : ORCHESTRATION_STATUS.NO_SEMANTIC_EVIDENCE;

  return freeze({
    schemaVersion: 1,
    projectId: profile.projectId,
    caseId: isolatedCaseId,
    orchestrationStatus,
    evidenceDomainPlan,
    semanticRuleCoverage,
    mappings,
    facts,
    reconciliations,
    readiness,
    engineRoute,
    counts: {
      parsedDocumentBundles: parsedDocuments.length,
      mappedDocuments: mappings.filter((mapping) => mapping.status === 'MAPPED').length,
      evidenceFacts: facts.length,
      reconciliationKeys: reconciliations.length,
    },
    semantics: 'Universal orchestration separates project classification, evidence extraction, reconciliation, readiness, and financial-engine qualification. It never produces an investment recommendation by itself.',
  });
}

module.exports = { ORCHESTRATION_STATUS, orchestrateProjectEvidence };
