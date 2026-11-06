'use strict';

const { requireVerifiedIdentityContext } = require('../security/verified-identity-context');
const {checkCanonicalAppraisalReportEvidence}=require('./canonical-appraisal-report-gate');
const { normalizePolicy, requireAuthorizedAction } = require('../security/authorization-audit');
const {
  REPORT_QA_STATUS,
  createProfessionalReportContract,
  verifyProfessionalReportContract,
  assessProfessionalReportQa,
} = require('../reporting/professional-report-contract');

const REPORT_RUNTIME_ACTION = Object.freeze({
  PREPARE: 'PREPARE_INTERNAL_REPORT',
  REVALIDATE: 'REVALIDATE_INTERNAL_REPORT',
});

const REPORT_RUNTIME_STATUS = Object.freeze({
  READY_FOR_INTERNAL_QA: 'READY_FOR_INTERNAL_QA',
  REPORT_BLOCKED: 'REPORT_BLOCKED',
  REPORT_REVALIDATED: 'REPORT_REVALIDATED',
});

const DEFAULT_REPORT_RUNTIME_POLICY = normalizePolicy({
  [REPORT_RUNTIME_ACTION.PREPARE]: ['ANALYST', 'ADMIN'],
  [REPORT_RUNTIME_ACTION.REVALIDATE]: ['ANALYST', 'IC_MEMBER', 'ADMIN'],
});

function requiredString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new TypeError(`${field} must be a non-empty string`);
  }
  return value.trim();
}

function requiredObject(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${field} must be an object`);
  }
  return value;
}

function fail(code, message = code) {
  const error = new Error(message);
  error.code = code;
  throw error;
}

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) freeze(child);
  return value;
}

function assertNoCallerAuthorityOverride({
  caseId,
  projectId,
  tenantId,
  actorId,
  identityContext,
  propertyRef,
  preparer,
} = {}) {
  if (
    caseId != null
    || projectId != null
    || tenantId != null
    || actorId != null
    || identityContext != null
    || propertyRef != null
    || preparer != null
  ) {
    fail('CALLER_REPORT_AUTHORITY_OVERRIDE_NOT_ALLOWED');
  }
}

function extractWorkspaceScope(loaded, requestedWorkspaceId) {
  if (!loaded || loaded.status !== 'OK') fail('UNEXPECTED_WORKSPACE_SERVICE_RESPONSE');
  if (!loaded.data) fail('CANONICAL_WORKSPACE_NOT_FOUND');
  const envelope = loaded.data;
  const workspace = requiredObject(envelope.workspace, 'workspaceEnvelope.workspace');
  const workspaceId = requiredString(workspace.workspaceId, 'workspace.workspaceId');
  if (workspaceId !== requestedWorkspaceId || envelope.workspaceId !== requestedWorkspaceId) {
    fail('PERSISTED_WORKSPACE_IDENTITY_MISMATCH');
  }
  if (!Number.isInteger(envelope.version) || envelope.version < 1) {
    fail('INVALID_PERSISTED_WORKSPACE_VERSION');
  }
  return freeze({
    workspaceId,
    workspaceVersion: envelope.version,
    tenantId: requiredString(envelope.tenantId, 'workspaceEnvelope.tenantId'),
    projectId: requiredString(workspace.projectId, 'workspace.projectId'),
    caseId: requiredString(workspace.caseId, 'workspace.caseId'),
    scopeDerivedFrom: 'AUTHENTICATED_CANONICAL_WORKSPACE',
  });
}

function createAuthenticatedReportingService({
  authenticator,
  workspaceService,
  standardsHashFn,
  requiredTenantId,
  appraisalEvidenceResolver=null,
  policy = DEFAULT_REPORT_RUNTIME_POLICY,
} = {}) {
  if (!authenticator || typeof authenticator.authenticate !== 'function') {
    throw new TypeError('authenticator.authenticate is required');
  }
  if (!workspaceService || typeof workspaceService.loadWorkspace !== 'function') {
    throw new TypeError('workspaceService.loadWorkspace is required');
  }
  if (typeof standardsHashFn !== 'function') throw new TypeError('standardsHashFn is required');
  if(appraisalEvidenceResolver!==null&&typeof appraisalEvidenceResolver?.readForReport!=='function')
    throw new TypeError('appraisalEvidenceResolver.readForReport is required');
  const configuredTenantId = requiredTenantId == null ? null : requiredString(requiredTenantId, 'requiredTenantId');
  const normalizedPolicy = normalizePolicy(policy);

  async function authenticate(authorizationHeader, nowEpochSeconds) {
    const result = await authenticator.authenticate({
      authorizationHeader,
      requiredTenantId: configuredTenantId || undefined,
      nowEpochSeconds,
    });
    if (!result || result.authorizationReady !== true || !result.identityContext) {
      fail('AUTHENTICATION_REQUIRED');
    }
    return {
      identityContext: result.identityContext,
      identity: requireVerifiedIdentityContext(result.identityContext),
    };
  }

  async function loadScope({ authorizationHeader, workspaceId, nowEpochSeconds }) {
    const normalizedWorkspaceId = requiredString(workspaceId, 'workspaceId');
    const loaded = await workspaceService.loadWorkspace({
      authorizationHeader,
      workspaceId: normalizedWorkspaceId,
      nowEpochSeconds,
    });
    return extractWorkspaceScope(loaded, normalizedWorkspaceId);
  }

  async function checkCurrentAppraisal({sourceContext,propertyRef}){
    if(appraisalEvidenceResolver===null)
      return checkCanonicalAppraisalReportEvidence({sourceContext,propertyRef});
    let record;
    try{
      record=await appraisalEvidenceResolver.readForReport({
        tenantId:sourceContext.tenantId,projectId:sourceContext.projectId,
        caseId:sourceContext.caseId,workspaceId:sourceContext.workspaceId,
        workspaceVersion:sourceContext.workspaceVersion,propertyRef,
      });
    }catch(_){
      return Object.freeze({status:'HOLD_CANONICAL_APPRAISAL_REPORT',
        blockInternalQa:true,sourceAuthenticated:false,independentMarketVerified:false,
        professionalReportAuthorized:false,reasons:Object.freeze(['CANONICAL_APPRAISAL_RESOLVER_FAILED'])});
    }
    return checkCanonicalAppraisalReportEvidence({sourceContext,propertyRef,record,resolverConfigured:true});
  }

  async function prepareReport({
    authorizationHeader,
    workspaceId,
    nowEpochSeconds,
    reportInput,
    caseId,
    projectId,
    tenantId,
    actorId,
    identityContext,
    propertyRef,
    preparer,
  } = {}) {
    assertNoCallerAuthorityOverride({ caseId, projectId, tenantId, actorId, identityContext, propertyRef, preparer });
    const auth = await authenticate(authorizationHeader, nowEpochSeconds);
    requireAuthorizedAction({
      identity: auth.identity,
      action: REPORT_RUNTIME_ACTION.PREPARE,
      policy: normalizedPolicy,
    });
    const sourceContext = await loadScope({ authorizationHeader, workspaceId, nowEpochSeconds });
    if (sourceContext.tenantId !== auth.identity.tenantId) fail('AUTHENTICATED_TENANT_SCOPE_MISMATCH');

    const input = requiredObject(reportInput, 'reportInput');
    if (
      input.caseId != null
      || input.projectId != null
      || input.tenantId != null
      || input.actorId != null
      || input.identityContext != null
      || input.propertyRef != null
      || input.preparer != null
      || input.appraisalGate != null
      || input.appraisalEvidence != null
    ) {
      fail('CALLER_REPORT_AUTHORITY_OVERRIDE_NOT_ALLOWED');
    }
    const assignment = requiredObject(input.assignment, 'reportInput.assignment');
    if (assignment.caseId !== sourceContext.caseId) fail('REPORT_ASSIGNMENT_CASE_MISMATCH');
    const derivedPropertyRef = requiredString(assignment.valuedPropertyInterestId, 'assignment.valuedPropertyInterestId');
    const appraisalGate=await checkCurrentAppraisal({sourceContext,propertyRef:derivedPropertyRef});

    const report = createProfessionalReportContract({
      ...input,
      caseId: sourceContext.caseId,
      propertyRef: derivedPropertyRef,
      preparer: {
        partyId: auth.identity.actorId,
        role: 'INTERNAL_PREPARER',
        credentialRef: null,
      },
      standardsHashFn,
    });
    const qa = assessProfessionalReportQa(report);

    return freeze({
      status: !appraisalGate.blockInternalQa&&qa.qaStatus === REPORT_QA_STATUS.READY_FOR_INTERNAL_QA
        ? REPORT_RUNTIME_STATUS.READY_FOR_INTERNAL_QA
        : REPORT_RUNTIME_STATUS.REPORT_BLOCKED,
      sourceContext,
      preparedBy: auth.identity.actorId,
      report,
      qa,
      appraisalGate,
      runtimeState: {
        reportPersisted: false,
        professionalCredentialValidatedHere: false,
        professionalReviewerApprovalEstablishedHere: false,
        externalConformanceValidatedHere: false,
      },
      authority: {
        internalQaOnly: true,
        professionalValuationAuthorized: false,
        certifiedValuationAuthorized: false,
        externalIssuanceAuthorized: false,
        legalOpinionEstablished: false,
        releaseAuthorized: false,
        mergeAuthorized: false,
        deploymentAuthorized: false,
        transactionAuthorized: false,
      },
    });
  }

  async function revalidateReport({
    authorizationHeader,
    workspaceId,
    nowEpochSeconds,
    preparedReport,
    caseId,
    projectId,
    tenantId,
    actorId,
    identityContext,
  } = {}) {
    assertNoCallerAuthorityOverride({ caseId, projectId, tenantId, actorId, identityContext });
    const auth = await authenticate(authorizationHeader, nowEpochSeconds);
    requireAuthorizedAction({
      identity: auth.identity,
      action: REPORT_RUNTIME_ACTION.REVALIDATE,
      policy: normalizedPolicy,
    });
    requiredObject(preparedReport, 'preparedReport');
    const preparedSource = requiredObject(preparedReport.sourceContext, 'preparedReport.sourceContext');
    const report = requiredObject(preparedReport.report, 'preparedReport.report');
    const currentSource = await loadScope({ authorizationHeader, workspaceId, nowEpochSeconds });

    if (currentSource.tenantId !== auth.identity.tenantId) fail('AUTHENTICATED_TENANT_SCOPE_MISMATCH');
    if (
      preparedSource.workspaceId !== currentSource.workspaceId
      || preparedSource.tenantId !== currentSource.tenantId
      || preparedSource.projectId !== currentSource.projectId
      || preparedSource.caseId !== currentSource.caseId
    ) {
      fail('PREPARED_REPORT_SCOPE_MISMATCH');
    }
    if (preparedSource.workspaceVersion !== currentSource.workspaceVersion) {
      fail('PREPARED_REPORT_STALE_WORKSPACE_VERSION');
    }
    if (report.caseId !== currentSource.caseId) fail('PREPARED_REPORT_CASE_MISMATCH');
    const derivedPropertyRef=requiredString(report.propertyRef,'report.propertyRef');
    const appraisalGate=await checkCurrentAppraisal({sourceContext:currentSource,propertyRef:derivedPropertyRef});

    const integrity = verifyProfessionalReportContract(report);
    if (!integrity.valid) fail('PREPARED_REPORT_INTEGRITY_FAILURE');
    const qa = assessProfessionalReportQa(report);

    return freeze({
      status: appraisalGate.blockInternalQa?REPORT_RUNTIME_STATUS.REPORT_BLOCKED:REPORT_RUNTIME_STATUS.REPORT_REVALIDATED,
      sourceContext: currentSource,
      appraisalGate,
      report,
      integrity,
      qa,
      revalidatedBy: auth.identity.actorId,
      runtimeState: {
        reportPersisted: false,
        professionalCredentialValidatedHere: false,
        professionalReviewerApprovalEstablishedHere: false,
        externalConformanceValidatedHere: false,
      },
      authority: {
        internalQaOnly: true,
        professionalValuationAuthorized: false,
        certifiedValuationAuthorized: false,
        externalIssuanceAuthorized: false,
        legalOpinionEstablished: false,
        releaseAuthorized: false,
        mergeAuthorized: false,
        deploymentAuthorized: false,
        transactionAuthorized: false,
      },
    });
  }

  return Object.freeze({
    prepareReport,
    revalidateReport,
    requiredTenantId: configuredTenantId,
    policy: normalizedPolicy,
    authority: Object.freeze({
      internalQaOnly: true,
      professionalValuationAuthorized: false,
      certifiedValuationAuthorized: false,
      externalIssuanceAuthorized: false,
      legalOpinionEstablished: false,
      releaseAuthorized: false,
      mergeAuthorized: false,
      deploymentAuthorized: false,
      transactionAuthorized: false,
    }),
    semantics: 'This runtime binds internal report preparation and revalidation to authenticated canonical-workspace scope and version. The authenticated actor is the internal preparer; professional credentials, reviewer approval, official Taqeem/IVS/RICS conformance, external issuance, legal opinion, and transaction authority remain unestablished and prohibited here.',
  });
}

module.exports = {
  REPORT_RUNTIME_ACTION,
  REPORT_RUNTIME_STATUS,
  DEFAULT_REPORT_RUNTIME_POLICY,
  createAuthenticatedReportingService,
};
