'use strict';

const { createExecutableInvestmentCase } = require('../contracts/executable-investment-case');

const EXECUTABLE_CASE_ORCHESTRATION_STATUS = Object.freeze({
  CASE_ASSEMBLED: 'CASE_ASSEMBLED',
  CASE_ASSEMBLED_WITH_LIFECYCLE_GAPS: 'CASE_ASSEMBLED_WITH_LIFECYCLE_GAPS',
});

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) freeze(child);
  return value;
}

function assertObject(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${name} must be an object`);
  }
}

function requiredString(value, name) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new TypeError(`${name} must be a non-empty string`);
  }
  return value.trim();
}

function assertIdentity(candidate, { projectId, caseId, label }) {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return;
  if (candidate.projectId != null && candidate.projectId !== projectId) {
    throw new TypeError(`PROJECT_ISOLATION_VIOLATION:${label}`);
  }
  if (candidate.caseId != null && candidate.caseId !== caseId) {
    throw new TypeError(`CASE_ISOLATION_VIOLATION:${label}`);
  }
}

function assertDomainIsolation(domainOutputs, identity) {
  for (const [key, value] of Object.entries(domainOutputs)) {
    assertIdentity(value, { ...identity, label: `DOMAIN_OUTPUT:${key}` });
    if (value && typeof value === 'object' && Array.isArray(value.items)) {
      for (let index = 0; index < value.items.length; index += 1) {
        assertIdentity(value.items[index], {
          ...identity,
          label: `DOMAIN_OUTPUT:${key}.items[${index}]`,
        });
      }
    }
  }
}

/**
 * Assemble one canonical ExecutableInvestmentCase from already-produced domain
 * outputs. This function deliberately does not invoke a financial engine, fetch
 * external data, infer missing lifecycle work, or authorize a professional or
 * transaction outcome.
 *
 * The caller must supply the exact `engineResult` already produced by the
 * canonical calculation engine. Keeping calculation outside this orchestrator
 * prevents a second formula path and makes the integration layer auditable.
 */
function assembleExecutableInvestmentCase({
  profile,
  caseId,
  studyType,
  inputs,
  engineResult,
  verdict,
  domainOutputs = {},
  analyticalPackage = null,
  standardsContext = null,
} = {}) {
  assertObject(profile, 'profile');
  assertObject(inputs, 'inputs');
  assertObject(engineResult, 'engineResult');
  assertObject(domainOutputs, 'domainOutputs');

  const projectId = requiredString(profile.projectId, 'profile.projectId');
  const normalizedCaseId = requiredString(caseId, 'caseId');
  requiredString(studyType, 'studyType');

  assertIdentity(profile, { projectId, caseId: normalizedCaseId, label: 'PROFILE' });
  assertIdentity(engineResult, { projectId, caseId: normalizedCaseId, label: 'ENGINE_RESULT' });
  assertIdentity(analyticalPackage, { projectId, caseId: normalizedCaseId, label: 'ANALYTICAL_PACKAGE' });
  assertIdentity(standardsContext, { projectId, caseId: normalizedCaseId, label: 'STANDARDS_CONTEXT' });
  assertDomainIsolation(domainOutputs, { projectId, caseId: normalizedCaseId });

  // These values are controlled by the orchestration boundary. A caller cannot
  // smuggle a different analytical package or project profile through domainOutputs.
  const controlledDomainOutputs = {
    ...domainOutputs,
    analyticalPackage,
    projectProfile: profile,
  };

  const executableCase = createExecutableInvestmentCase({
    projectId,
    caseId: normalizedCaseId,
    studyType,
    inputs,
    engineResult,
    verdict,
    domainOutputs: controlledDomainOutputs,
    standardsContext,
  });

  const unresolved = executableCase.lifecycleCoverage.unresolved.slice();
  const status = unresolved.length === 0
    ? EXECUTABLE_CASE_ORCHESTRATION_STATUS.CASE_ASSEMBLED
    : EXECUTABLE_CASE_ORCHESTRATION_STATUS.CASE_ASSEMBLED_WITH_LIFECYCLE_GAPS;

  return freeze({
    schemaVersion: 1,
    status,
    projectId,
    caseId: normalizedCaseId,
    executableCase,
    unresolvedLifecycleSections: unresolved,
    reasonCodes: unresolved.map((section) => `LIFECYCLE_GAP:${section}`),
    boundaries: {
      externalDataFetchedByThisOrchestrator: false,
      financialEngineInvokedByThisOrchestrator: false,
      canonicalFinancialFormulaChanged: false,
      missingLifecycleWorkInferred: false,
      professionalOpinionProduced: false,
      certifiedValuationProduced: false,
      automatedInvestmentDecisionProduced: false,
    },
    humanDecisionRequired: true,
    transactionAuthorized: false,
    semantics: 'Canonical case assembly only. Domain and engine outputs are represented without recomputation, inferred completion, professional certification, or transaction authority.',
  });
}

module.exports = {
  EXECUTABLE_CASE_ORCHESTRATION_STATUS,
  assembleExecutableInvestmentCase,
};
