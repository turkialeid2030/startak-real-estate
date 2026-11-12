'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  STATUS,
  EXTERNAL_AUTH_STATUS,
  createProductionProviderConfiguration,
  verifyProductionProviderConfiguration,
  createExternalProductionAuthorizationEvidence,
  verifyExternalProductionAuthorizationEvidence,
  evaluateInternalProductionReadiness,
  evaluateExternalAuthorizationForGateIngestion,
  evaluateProductionInvocationAuthorization,
} = require('../../src/ai/provider-production-readiness');

const ROOT = path.join(__dirname, '..', '..');
const AS_OF = '2026-10-04T09:00:00.000Z';
const SHA = '1234567890abcdef1234567890abcdef12345678';
const H = (character) => character.repeat(64);
let checks = 0;
function check(fn) { fn(); checks += 1; }
function read(relativePath) { return fs.readFileSync(path.join(ROOT, relativePath), 'utf8'); }

function configuration(overrides = {}) {
  return createProductionProviderConfiguration({
    configurationId: 'C48-PROVIDER-CONFIG-1',
    candidateHeadSha: SHA,
    useCaseId: 'STARTAK-REAL-ESTATE-GROUNDED-EXECUTIVE-DRAFT',
    providerId: 'PROVIDER-PENDING-INDEPENDENT-AUTHORIZATION',
    modelId: 'MODEL-PINNED-FOR-REVIEW',
    modelVersionRef: 'MODEL-VERSION-PINNED-FOR-REVIEW',
    credentialIsolationEvidenceRef: 'EVIDENCE-CREDENTIAL-ISOLATION',
    dataHandlingEvidenceRef: 'EVIDENCE-DATA-HANDLING',
    retentionEvidenceRef: 'EVIDENCE-RETENTION',
    trainingUseEvidenceRef: 'EVIDENCE-NO-TRAINING',
    dataResidencyEvidenceRef: 'EVIDENCE-RESIDENCY',
    loggingEvidenceRef: 'EVIDENCE-LOGGING',
    dlpEvidenceRef: 'EVIDENCE-DLP',
    promptRegistryRef: 'EVIDENCE-PROMPT-REGISTRY',
    roleAuthorizationRef: 'EVIDENCE-ROLE-AUTH',
    environmentAuthorizationRef: 'EVIDENCE-PRODUCTION-ENV-BOUNDARY',
    killSwitchRef: 'EVIDENCE-KILL-SWITCH',
    evidenceHashesSha256: [H('1'), H('2'), H('3'), H('4'), H('5'), H('6'), H('7'), H('8'), H('9'), H('a'), H('b')],
    productionCredentialsSeparated: true,
    secretsStoredInConfiguration: false,
    trainingUseCustomerData: false,
    killSwitchValidated: true,
    dlpEnforced: true,
    productionProviderUseAuthorized: false,
    publicAiAuthorized: false,
    productionInvocationAuthorized: false,
    reviewedByRef: 'C48-INTERNAL-ENGINEERING-REVIEW',
    reviewedAt: '2026-10-04T07:00:00.000Z',
    validUntil: '2026-10-11T07:00:00.000Z',
    ...overrides,
  });
}

function external(config, status, overrides = {}) {
  const base = {
    evidenceId: 'AI_PROVIDER_PRODUCTION_AUTHORIZATION',
    candidateHeadSha: config.candidateHeadSha,
    useCaseId: config.useCaseId,
    providerId: config.providerId,
    modelId: config.modelId,
    modelVersionRef: config.modelVersionRef,
    status,
  };
  if (status === EXTERNAL_AUTH_STATUS.SUPPLIED_VERIFIED) {
    Object.assign(base, {
      evidenceRef: 'INDEPENDENT-AUTHORIZATION-ARTIFACT',
      evidenceHashSha256: H('c'),
      verifiedByRef: 'INDEPENDENT-AUTHORIZED-REVIEWER',
      verifiedAt: '2026-10-04T08:00:00.000Z',
      validUntil: '2026-10-10T08:00:00.000Z',
    });
  }
  if (status === EXTERNAL_AUTH_STATUS.REJECTED) {
    Object.assign(base, {
      evidenceRef: 'INDEPENDENT-REJECTION-ARTIFACT',
      evidenceHashSha256: H('d'),
      verifiedByRef: 'INDEPENDENT-AUTHORIZED-REVIEWER',
      verifiedAt: '2026-10-04T08:00:00.000Z',
      reasonCode: 'PROVIDER_TERMS_NOT_APPROVED',
    });
  }
  return createExternalProductionAuthorizationEvidence({ ...base, ...overrides });
}

const config = configuration();
check(() => assert.strictEqual(verifyProductionProviderConfiguration(config), true));
check(() => assert.strictEqual(config.productionCredentialsSeparated, true));
check(() => assert.strictEqual(config.trainingUseCustomerData, false));
check(() => assert.strictEqual(config.secretsStoredInConfiguration, false));
check(() => assert.strictEqual(config.publicAiAuthorized, false));
check(() => assert.strictEqual(config.productionProviderUseAuthorized, false));
check(() => assert.strictEqual(config.productionInvocationAuthorized, false));
check(() => assert.strictEqual(config.transactionAuthorized, false));
check(() => assert.strictEqual(config.approvalAuthorized, false));

const internal = evaluateInternalProductionReadiness({ configuration: config, asOf: AS_OF });
check(() => assert.strictEqual(internal.status, STATUS.READY_FOR_INDEPENDENT_PROVIDER_AUTHORIZATION_REVIEW));
check(() => assert.strictEqual(internal.internalEngineeringReady, true));
check(() => assert.deepStrictEqual(internal.blockers, []));
check(() => assert.strictEqual(internal.externalGateId, '547'));
check(() => assert.strictEqual(internal.externalAuthorizationSupplied, false));
check(() => assert.strictEqual(internal.publicAiAuthorized, false));
check(() => assert.strictEqual(internal.productionInvocationAuthorized, false));
check(() => assert.strictEqual(internal.deploymentAuthorized, false));
check(() => assert.strictEqual(internal.commercialGoLiveAuthorized, false));

check(() => assert.throws(() => configuration({ apiKey: 'must-never-appear' }), /C48_SECRET_MATERIAL_FIELD_FORBIDDEN/));
check(() => assert.throws(() => configuration({ secret: 'must-never-appear' }), /C48_SECRET_MATERIAL_FIELD_FORBIDDEN/));
check(() => assert.throws(() => configuration({ productionCredentialsSeparated: false }), /C48_PRODUCTION_CREDENTIAL_ISOLATION_REQUIRED/));
check(() => assert.throws(() => configuration({ trainingUseCustomerData: true }), /C48_CUSTOMER_DATA_TRAINING_MUST_BE_FALSE/));
check(() => assert.throws(() => configuration({ secretsStoredInConfiguration: true }), /C48_SECRETS_MUST_NOT_BE_STORED_IN_CONFIGURATION/));
check(() => assert.throws(() => configuration({ killSwitchValidated: false }), /C48_KILL_SWITCH_VALIDATION_REQUIRED/));
check(() => assert.throws(() => configuration({ dlpEnforced: false }), /C48_DLP_ENFORCEMENT_REQUIRED/));
check(() => assert.throws(() => configuration({ productionProviderUseAuthorized: true }), /C48_INTERNAL_CONFIGURATION_CANNOT_GRANT_EXTERNAL_PRODUCTION_AUTHORITY/));
check(() => assert.throws(() => configuration({ publicAiAuthorized: true }), /C48_INTERNAL_CONFIGURATION_CANNOT_GRANT_EXTERNAL_PRODUCTION_AUTHORITY/));
check(() => assert.throws(() => configuration({ productionInvocationAuthorized: true }), /C48_INTERNAL_CONFIGURATION_CANNOT_GRANT_EXTERNAL_PRODUCTION_AUTHORITY/));
check(() => assert.throws(() => configuration({ candidateHeadSha: 'not-a-commit' }), /candidateHeadSha must be a 40-character Git commit SHA/));
check(() => assert.throws(() => configuration({ evidenceHashesSha256: [H('1')] }), /C48_MINIMUM_CONTROL_EVIDENCE_HASHES_REQUIRED/));

const staleConfig = configuration({ configurationId: 'STALE', validUntil: '2026-10-04T08:00:00.000Z' });
const stale = evaluateInternalProductionReadiness({ configuration: staleConfig, asOf: AS_OF });
check(() => assert.strictEqual(stale.status, STATUS.HOLD_WINDOW));
check(() => assert(stale.blockers.includes('C48_WINDOW_CONFIGURATION_EXPIRED')));

const tampered = { ...config, modelId: 'TAMPERED' };
const tamperedResult = evaluateInternalProductionReadiness({ configuration: tampered, asOf: AS_OF });
check(() => assert.strictEqual(tamperedResult.status, STATUS.HOLD_INTEGRITY));
check(() => assert(tamperedResult.blockers.includes('C48_INTEGRITY_CONFIGURATION')));

const missing = external(config, EXTERNAL_AUTH_STATUS.NOT_SUPPLIED);
check(() => assert.strictEqual(verifyExternalProductionAuthorizationEvidence(missing), true));
const missingResult = evaluateExternalAuthorizationForGateIngestion({ configuration: config, externalAuthorization: missing, asOf: AS_OF });
check(() => assert.strictEqual(missingResult.status, STATUS.HOLD_EXTERNAL_AUTHORIZATION));
check(() => assert.strictEqual(missingResult.readyForC30GateIngestion, false));
check(() => assert(missingResult.blockers.includes('C48_EXTERNAL_AUTHORIZATION_NOT_SUPPLIED')));
check(() => assert.strictEqual(missingResult.publicAiAuthorized, false));
check(() => assert.strictEqual(missingResult.productionInvocationAuthorized, false));

check(() => assert.throws(() => createExternalProductionAuthorizationEvidence({
  evidenceId: 'BAD-NOT-SUPPLIED', candidateHeadSha: SHA, useCaseId: config.useCaseId, providerId: config.providerId,
  modelId: config.modelId, modelVersionRef: config.modelVersionRef, status: EXTERNAL_AUTH_STATUS.NOT_SUPPLIED,
  evidenceRef: 'SYNTHETIC',
}), /C48_NOT_SUPPLIED_MUST_NOT_CARRY_SYNTHETIC_APPROVAL_EVIDENCE/));

const rejected = external(config, EXTERNAL_AUTH_STATUS.REJECTED);
const rejectedResult = evaluateExternalAuthorizationForGateIngestion({ configuration: config, externalAuthorization: rejected, asOf: AS_OF });
check(() => assert.strictEqual(rejectedResult.status, STATUS.REJECTED));
check(() => assert(rejectedResult.blockers.some((item) => item.startsWith('C48_EXTERNAL_AUTHORIZATION_REJECTED:'))));
check(() => assert.strictEqual(rejectedResult.productionInvocationAuthorized, false));

const supplied = external(config, EXTERNAL_AUTH_STATUS.SUPPLIED_VERIFIED);
check(() => assert.strictEqual(verifyExternalProductionAuthorizationEvidence(supplied), true));
const ingestion = evaluateExternalAuthorizationForGateIngestion({ configuration: config, externalAuthorization: supplied, asOf: AS_OF });
check(() => assert.strictEqual(ingestion.status, STATUS.READY_FOR_C30_GATE_INGESTION));
check(() => assert.strictEqual(ingestion.readyForC30GateIngestion, true));
check(() => assert.strictEqual(ingestion.externalAuthorizationRecordStructurallyComplete, true));
check(() => assert.strictEqual(ingestion.independentAuthorityStillMustBeValidatedByC30, true));
check(() => assert.strictEqual(ingestion.publicAiAuthorized, false));
check(() => assert.strictEqual(ingestion.productionProviderUseAuthorized, false));
check(() => assert.strictEqual(ingestion.productionInvocationAuthorized, false));

const wrongBinding = external(config, EXTERNAL_AUTH_STATUS.SUPPLIED_VERIFIED, { useCaseId: 'OTHER-USE-CASE', evidenceId: 'WRONG-BINDING' });
const wrongBindingResult = evaluateExternalAuthorizationForGateIngestion({ configuration: config, externalAuthorization: wrongBinding, asOf: AS_OF });
check(() => assert.strictEqual(wrongBindingResult.status, STATUS.HOLD_EXTERNAL_AUTHORIZATION));
check(() => assert(wrongBindingResult.blockers.includes('C48_EXTERNAL_AUTH_BINDING_MISMATCH:useCaseId')));

const expiredExternal = external(config, EXTERNAL_AUTH_STATUS.SUPPLIED_VERIFIED, { evidenceId: 'EXPIRED-EXTERNAL', validUntil: '2026-10-04T08:30:00.000Z' });
const expiredExternalResult = evaluateExternalAuthorizationForGateIngestion({ configuration: config, externalAuthorization: expiredExternal, asOf: AS_OF });
check(() => assert.strictEqual(expiredExternalResult.status, STATUS.HOLD_EXTERNAL_AUTHORIZATION));
check(() => assert(expiredExternalResult.blockers.includes('C48_EXTERNAL_AUTHORIZATION_EXPIRED')));

const runtime = evaluateProductionInvocationAuthorization({ configuration: config, externalAuthorization: supplied, asOf: AS_OF });
check(() => assert.strictEqual(runtime.status, STATUS.HOLD_EXTERNAL_AUTHORIZATION));
check(() => assert(runtime.blockers.includes('C48_RUNTIME_PRODUCTION_INVOCATION_PATH_NOT_IMPLEMENTED')));
check(() => assert(runtime.blockers.includes('C48_C30_GATE_AUTHORITY_NOT_CONSUMED')));
check(() => assert.strictEqual(runtime.providerCallAllowed, false));
check(() => assert.strictEqual(runtime.publicAiAuthorized, false));
check(() => assert.strictEqual(runtime.productionInvocationAuthorized, false));

const c23 = read('src/ai/governed-live-provider-gateway.js');
check(() => assert(c23.includes("ISOLATED_NON_PRODUCTION: 'ISOLATED_NON_PRODUCTION'")));
check(() => assert(c23.includes('productionDeploymentAuthorized: false')));
check(() => assert(c23.includes('publicAiAuthorized: false')));
check(() => assert(c23.includes('C23_PRIVACY_PERSONAL_DATA_EXTERNAL_TRANSFER_NOT_AUTHORIZED')));

const evidence = JSON.parse(read('release/evidence/c48-internal-ai-provider-production-readiness.json'));
check(() => assert.strictEqual(evidence.externalGateId, 547));
for (const field of ['externalProductionAuthorizationSupplied', 'gate547Satisfied', 'publicAiAuthorized', 'productionProviderUseAuthorized', 'productionInvocationAuthorized', 'deploymentAuthorized', 'commercialGoLiveAuthorized']) {
  check(() => assert.strictEqual(evidence[field], false, `${field} must remain false`));
}

const docs = read('docs/C48_INTERNAL_AI_PROVIDER_PRODUCTION_READINESS.md');
check(() => assert(docs.includes('does not satisfy external gate #547')));
check(() => assert(docs.includes('A working API key is not production authorization')));
check(() => assert(docs.includes('PUBLIC_AI=FALSE')));
check(() => assert(docs.includes('production invocation remains blocked')));

const workflow = read('.github/workflows/c48-internal-ai-provider-production-readiness.yml');
const immutableUse = /^\s*-?\s*uses:\s*[^\s@]+@[a-f0-9]{40}\s*$/i;
const usesLines = workflow.split(/\r?\n/).filter((line) => /^\s*-?\s*uses:/.test(line));
check(() => assert(usesLines.length > 0));
usesLines.forEach((line) => check(() => assert(immutableUse.test(line), `mutable action reference: ${line.trim()}`)));
check(() => assert(workflow.includes('C48_GATE_547_SATISFIED=FALSE')));
check(() => assert(workflow.includes('C48_PUBLIC_AI_AUTHORIZED=FALSE')));
check(() => assert(workflow.includes('C48_PRODUCTION_INVOCATION_AUTHORIZED=FALSE')));

console.log(`C48_INTERNAL_AI_PROVIDER_PRODUCTION_READINESS=PASS checks=${checks}`);
console.log('C48_READY_FOR_INDEPENDENT_PROVIDER_AUTHORIZATION_REVIEW=PASS');
console.log('C48_GATE_547_SATISFIED=FALSE');
console.log('C48_PUBLIC_AI_AUTHORIZED=FALSE');
console.log('C48_PRODUCTION_INVOCATION_AUTHORIZED=FALSE');
console.log('C48_DEPLOYMENT_AUTHORIZED=FALSE');
console.log('C48_COMMERCIAL_GO_LIVE_AUTHORIZED=FALSE');
