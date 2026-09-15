'use strict';

const assert = require('assert');
const crypto = require('crypto');
const { createVerifiedIdentityContext } = require('../../src/security/verified-identity-context');
const { createCanonicalWorkspacePersistence } = require('../../src/runtime/canonical-workspace-persistence');
const { createCanonicalWorkspaceRuntime } = require('../../src/runtime/canonical-workspace-runtime');
const { createAuthenticatedCanonicalWorkspaceService } = require('../../src/runtime/authenticated-canonical-workspace-service');
const { createAuthenticatedReportingService } = require('../../src/runtime/authenticated-reporting-service');
const { createStandardsSnapshot } = require('../../src/standards');
const { ASSIGNMENT_STATE } = require('../../src/valuation-assignment');
const {
  REPORT_TYPE,
  REPORT_QA_STATUS,
  METHOD_DISPOSITION,
  UNCERTAINTY_STATUS,
  ARTIFACT_TYPE,
  createReportArtifactReference,
} = require('../../src/reporting/professional-report-contract');

const NOW = 1_800_000_000;
const hashFn = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');

function identityContext({ sub, roles }) {
  return createVerifiedIdentityContext({
    claims: {
      sub,
      tenant_id: 'tenant-a',
      roles,
      iss: 'https://issuer.example/',
      aud: 'startak-real-estate-api',
      exp: NOW + 300,
    },
    tokenVerificationEvidence: { verified: true, verificationRef: `REPORT-${sub}` },
    requiredTenantId: 'tenant-a',
    nowEpochSeconds: NOW,
  });
}

function authenticator() {
  const identities = {
    'Bearer analyst-token': identityContext({ sub: 'analyst-1', roles: ['ANALYST'] }),
    'Bearer ic-token': identityContext({ sub: 'ic-1', roles: ['IC_MEMBER'] }),
    'Bearer viewer-token': identityContext({ sub: 'viewer-1', roles: ['VIEWER'] }),
  };
  return Object.freeze({
    async authenticate({ authorizationHeader, requiredTenantId }) {
      const context = identities[authorizationHeader];
      if (!context) return { authorizationReady: false, identityContext: null };
      if (requiredTenantId && context.identity.tenantId !== requiredTenantId) {
        return { authorizationReady: false, identityContext: null };
      }
      return { authorizationReady: true, identityContext: context };
    },
  });
}

function atomicMemoryProvider() {
  const values = new Map();
  return {
    values,
    providerName() { return 'ReportingMemoryProvider'; },
    async get(key) { return values.has(key) ? values.get(key) : null; },
    async compareAndSet(key, expectedRaw, nextRaw) {
      const current = values.has(key) ? values.get(key) : null;
      if (current !== expectedRaw) return false;
      values.set(key, nextRaw);
      return true;
    },
  };
}

function canonicalWorkspace() {
  return Object.freeze({
    schemaVersion: 1,
    workspaceId: 'WS-REPORT-001',
    projectId: 'PROJECT-REPORT-001',
    caseId: 'CASE-REPORT-001',
    status: 'CASE_ASSEMBLED',
    attribution: Object.freeze({ actorId: 'analyst-1', actorRole: 'ANALYST', source: 'IN_APP' }),
    executableCase: Object.freeze({ projectId: 'PROJECT-REPORT-001', caseId: 'CASE-REPORT-001' }),
    authority: Object.freeze({
      operatingMode: 'UNLICENSED_DECISION_SUPPORT',
      professionalReportExternalIssuanceAuthorized: false,
      releaseAuthorized: false,
      mergeAuthorized: false,
      deploymentAuthorized: false,
      transactionAuthorized: false,
    }),
  });
}

function assignment(caseId = 'CASE-REPORT-001') {
  return Object.freeze({
    engagementId: 'ENG-REPORT-001',
    caseId,
    purposeCode: 'INTERNAL_DECISION_SUPPORT',
    intendedUseCode: 'INTERNAL_QA_ONLY',
    basisOfValueCode: 'MARKET_VALUE_ANALYTICAL',
    valuedPropertyInterestId: 'PROPERTY-INTEREST-001',
    propertyInterestIds: ['PROPERTY-INTEREST-001'],
    valuationDate: '2026-09-01',
    assignmentState: ASSIGNMENT_STATE.AUTHORIZED_FOR_ANALYSIS,
  });
}

function standardsSnapshot() {
  return createStandardsSnapshot({
    standardsSnapshotId: 'STD-SNAPSHOT-REPORT-001',
    snapshotVersion: '1',
    createdAt: '2026-09-01T09:00:00Z',
    hashFn,
    routerVersion: 'router-v1',
    routerInputHash: null,
    standardRefs: [],
    ruleRefs: [],
    activationApprovalRefs: [],
    valuationDate: '2026-09-01',
    reportDate: '2026-09-02',
    engagementDate: '2026-08-30',
  });
}

function reportInput({ caseId = 'CASE-REPORT-001' } = {}) {
  const propertyRef = 'PROPERTY-INTEREST-001';
  const artifactReference = createReportArtifactReference({
    referenceId: 'REF-INCOME-001',
    artifactType: ARTIFACT_TYPE.INCOME_NOI_RESULT,
    artifactId: 'INCOME-RESULT-001',
    artifactHashSha256: 'a'.repeat(64),
    caseId,
    propertyRef,
    asOfDate: '2026-09-01',
    evidenceRefs: ['E-REPORT-001'],
  });
  return {
    reportId: 'REPORT-001',
    reportVersion: '1.0',
    reportType: REPORT_TYPE.INTERNAL_VALUATION_DRAFT,
    reportDate: '2026-09-02',
    assignment: assignment(caseId),
    standardsSnapshot: standardsSnapshot(),
    artifactReferences: [artifactReference],
    requiredArtifactTypes: [ARTIFACT_TYPE.INCOME_NOI_RESULT],
    methodAssessments: [{
      methodCode: 'INCOME_APPROACH',
      disposition: METHOD_DISPOSITION.USED,
      rationale: 'Internal analytical income result is supplied as a referenced artifact.',
      resultReferenceId: 'REF-INCOME-001',
    }],
    assumptions: [],
    specialAssumptions: [],
    limitations: ['Internal decision-support draft only.'],
    uncertaintyDisclosure: {
      status: UNCERTAINTY_STATUS.NONE_IDENTIFIED,
      rationale: 'No material uncertainty is asserted beyond the supplied analytical evidence for this fixture.',
      evidenceRefs: ['E-REPORT-001'],
    },
    reviewer: {
      partyId: 'reviewer-1',
      role: 'INTERNAL_REVIEWER',
      credentialRef: null,
    },
    createdAt: '2026-09-02T10:00:00Z',
  };
}

async function main() {
  let checks = 0;
  async function check(fn) { await fn(); checks++; }

  const auth = authenticator();
  const provider = atomicMemoryProvider();
  const persistence = createCanonicalWorkspacePersistence({
    storageProvider: provider,
    now: () => '2026-09-09T16:00:00Z',
  });
  const runtime = createCanonicalWorkspaceRuntime({ persistence });
  const workspaceService = createAuthenticatedCanonicalWorkspaceService({
    authenticator: auth,
    runtime,
    requiredTenantId: 'tenant-a',
  });
  const reportingService = createAuthenticatedReportingService({
    authenticator: auth,
    workspaceService,
    standardsHashFn: hashFn,
    requiredTenantId: 'tenant-a',
  });

  await workspaceService.saveWorkspace({
    authorizationHeader: 'Bearer analyst-token',
    workspace: canonicalWorkspace(),
    expectedVersion: 0,
    operationId: 'REPORT-WORKSPACE-SAVE-001',
    occurredAt: '2026-09-09T16:00:00Z',
    nowEpochSeconds: NOW,
  });

  const prepared = await reportingService.prepareReport({
    authorizationHeader: 'Bearer analyst-token',
    workspaceId: 'WS-REPORT-001',
    nowEpochSeconds: NOW,
    reportInput: reportInput(),
  });

  await check(async () => assert.strictEqual(prepared.status, 'READY_FOR_INTERNAL_QA'));
  await check(async () => assert.strictEqual(prepared.sourceContext.workspaceVersion, 1));
  await check(async () => assert.strictEqual(prepared.sourceContext.caseId, 'CASE-REPORT-001'));
  await check(async () => assert.strictEqual(prepared.sourceContext.projectId, 'PROJECT-REPORT-001'));
  await check(async () => assert.strictEqual(prepared.preparedBy, 'analyst-1'));
  await check(async () => assert.strictEqual(prepared.report.caseId, 'CASE-REPORT-001'));
  await check(async () => assert.strictEqual(prepared.report.propertyRef, 'PROPERTY-INTEREST-001'));
  await check(async () => assert.strictEqual(prepared.report.preparer.partyId, 'analyst-1'));
  await check(async () => assert.strictEqual(prepared.report.preparer.credentialRef, null));
  await check(async () => assert.strictEqual(prepared.report.qaStatus, REPORT_QA_STATUS.READY_FOR_INTERNAL_QA));
  await check(async () => assert.strictEqual(prepared.report.credentialValidationPerformed, false));
  await check(async () => assert.strictEqual(prepared.report.professionalReviewerApprovalEstablished, false));
  await check(async () => assert.strictEqual(prepared.report.externalIssuanceAuthorized, false));
  await check(async () => assert.strictEqual(prepared.report.certifiedValuationAuthorized, false));
  await check(async () => assert.strictEqual(prepared.report.transactionAuthorized, false));
  await check(async () => assert.strictEqual(prepared.qa.externalIssuanceAuthorized, false));
  await check(async () => assert.strictEqual(prepared.authority.internalQaOnly, true));
  await check(async () => assert.strictEqual(prepared.authority.transactionAuthorized, false));

  await check(async () => assert.rejects(
    reportingService.prepareReport({
      authorizationHeader: 'Bearer viewer-token',
      workspaceId: 'WS-REPORT-001',
      nowEpochSeconds: NOW,
      reportInput: reportInput(),
    }),
    (error) => error && error.code === 'ROLE_NOT_AUTHORIZED',
  ));

  await check(async () => assert.rejects(
    reportingService.prepareReport({
      authorizationHeader: 'Bearer analyst-token',
      workspaceId: 'WS-REPORT-001',
      nowEpochSeconds: NOW,
      reportInput: { ...reportInput(), caseId: 'FORGED-CASE' },
    }),
    (error) => error && error.code === 'CALLER_REPORT_AUTHORITY_OVERRIDE_NOT_ALLOWED',
  ));

  await check(async () => assert.rejects(
    reportingService.prepareReport({
      authorizationHeader: 'Bearer analyst-token',
      workspaceId: 'WS-REPORT-001',
      nowEpochSeconds: NOW,
      reportInput: { ...reportInput(), propertyRef: 'FORGED-PROPERTY' },
    }),
    (error) => error && error.code === 'CALLER_REPORT_AUTHORITY_OVERRIDE_NOT_ALLOWED',
  ));

  await check(async () => assert.rejects(
    reportingService.prepareReport({
      authorizationHeader: 'Bearer analyst-token',
      workspaceId: 'WS-REPORT-001',
      nowEpochSeconds: NOW,
      reportInput: reportInput({ caseId: 'CASE-OTHER' }),
    }),
    (error) => error && error.code === 'REPORT_ASSIGNMENT_CASE_MISMATCH',
  ));

  const revalidated = await reportingService.revalidateReport({
    authorizationHeader: 'Bearer ic-token',
    workspaceId: 'WS-REPORT-001',
    nowEpochSeconds: NOW,
    preparedReport: prepared,
  });
  await check(async () => assert.strictEqual(revalidated.status, 'REPORT_REVALIDATED'));
  await check(async () => assert.strictEqual(revalidated.integrity.valid, true));
  await check(async () => assert.strictEqual(revalidated.revalidatedBy, 'ic-1'));
  await check(async () => assert.strictEqual(revalidated.qa.qaStatus, REPORT_QA_STATUS.READY_FOR_INTERNAL_QA));
  await check(async () => assert.strictEqual(revalidated.authority.externalIssuanceAuthorized, false));

  const tampered = {
    ...prepared,
    report: { ...prepared.report, reportVersion: 'forged-version' },
  };
  await check(async () => assert.rejects(
    reportingService.revalidateReport({
      authorizationHeader: 'Bearer ic-token',
      workspaceId: 'WS-REPORT-001',
      nowEpochSeconds: NOW,
      preparedReport: tampered,
    }),
    (error) => error && error.code === 'PREPARED_REPORT_INTEGRITY_FAILURE',
  ));

  await workspaceService.saveWorkspace({
    authorizationHeader: 'Bearer analyst-token',
    workspace: canonicalWorkspace(),
    expectedVersion: 1,
    operationId: 'REPORT-WORKSPACE-SAVE-002',
    occurredAt: '2026-09-09T16:10:00Z',
    nowEpochSeconds: NOW,
  });

  await check(async () => assert.rejects(
    reportingService.revalidateReport({
      authorizationHeader: 'Bearer ic-token',
      workspaceId: 'WS-REPORT-001',
      nowEpochSeconds: NOW,
      preparedReport: prepared,
    }),
    (error) => error && error.code === 'PREPARED_REPORT_STALE_WORKSPACE_VERSION',
  ));

  await check(async () => assert.ok([...provider.values.keys()].every((key) => key.includes('tenant-a'))));

  console.log(`AUTHENTICATED_REPORTING_RUNTIME_V1: PASS (${checks} checks)`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
