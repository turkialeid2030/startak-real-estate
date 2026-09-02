'use strict';

const { TITLE_RESULT_STATUS } = require('../title-intelligence');
const { TENANT_RESULT_STATUS } = require('../tenant-intelligence');
const {
  TIME_LIMITED_INTEREST_TYPES,
  UNIT_OPERATING_STATUS,
  LEASE_LIFECYCLE_STATUS,
  OPERATING_INPUT_STATUS,
  LINEAGE_KIND,
  deepFreeze,
  evidenceAwareValuesForCase,
  collectOperatingCaseEvidenceRefs,
} = require('./contracts');

const OPERATING_UNDERWRITING_STATUS = Object.freeze({
  READY_FOR_OPERATING_UNDERWRITING: 'READY_FOR_OPERATING_UNDERWRITING',
  READY_WITH_ASSUMPTIONS: 'READY_WITH_ASSUMPTIONS',
  NEEDS_DUE_DILIGENCE: 'NEEDS_DUE_DILIGENCE',
  INSUFFICIENT_EVIDENCE: 'INSUFFICIENT_EVIDENCE',
  DECISION_BLOCKED: 'DECISION_BLOCKED',
});

const VALUE_SOURCE_LINEAGE_KINDS = Object.freeze([
  LINEAGE_KIND.SOURCE_DOCUMENT,
  LINEAGE_KIND.EVIDENCE_FACT,
  LINEAGE_KIND.HUMAN_VERIFICATION,
  LINEAGE_KIND.ANALYTICAL_ASSESSMENT,
  LINEAGE_KIND.LEGAL_REVIEW,
  LINEAGE_KIND.OTHER,
]);

function addUnique(target, item) {
  if (!target.some((candidate) => candidate.code === item.code && candidate.field === item.field && candidate.refId === item.refId)) {
    target.push(item);
  }
}

function dateMs(value) {
  return value ? new Date(value).getTime() : null;
}

function checkLineageKind({ value, lineageByRef, evidenceGaps }) {
  if (value.sourceRef) {
    const source = lineageByRef.get(value.sourceRef);
    if (source && !VALUE_SOURCE_LINEAGE_KINDS.includes(source.kind)) {
      addUnique(evidenceGaps, {
        code: 'INVALID_SOURCE_LINEAGE_KIND',
        field: value.field,
        refId: value.sourceRef,
        expected: 'source/evidence/assessment lineage',
        actual: source.kind,
      });
    }
  }
  if (value.adoptionDecisionRef) {
    const adoption = lineageByRef.get(value.adoptionDecisionRef);
    if (adoption && adoption.kind !== LINEAGE_KIND.UNDERWRITING_ADOPTION) {
      addUnique(evidenceGaps, {
        code: 'INVALID_ADOPTION_LINEAGE_KIND',
        field: value.field,
        refId: value.adoptionDecisionRef,
        expected: LINEAGE_KIND.UNDERWRITING_ADOPTION,
        actual: adoption.kind,
      });
    }
  }
  if (value.assumptionOverride) {
    const approver = lineageByRef.get(value.assumptionOverride.approvedByRef);
    if (approver && approver.kind !== LINEAGE_KIND.HUMAN_IDENTITY) {
      addUnique(evidenceGaps, {
        code: 'INVALID_ASSUMPTION_APPROVER_LINEAGE_KIND',
        field: value.field,
        refId: value.assumptionOverride.approvedByRef,
        expected: LINEAGE_KIND.HUMAN_IDENTITY,
        actual: approver.kind,
      });
    }
    if (value.assumptionOverride.policyRef) {
      const policy = lineageByRef.get(value.assumptionOverride.policyRef);
      if (policy && policy.kind !== LINEAGE_KIND.POLICY) {
        addUnique(evidenceGaps, {
          code: 'INVALID_ASSUMPTION_POLICY_LINEAGE_KIND',
          field: value.field,
          refId: value.assumptionOverride.policyRef,
          expected: LINEAGE_KIND.POLICY,
          actual: policy.kind,
        });
      }
    }
  }
}

function assessOperatingUnderwritingReadiness(operatingCase) {
  if (!operatingCase || operatingCase.contractType !== 'RESIDENTIAL_INCOME_OPERATING_CASE_V1') {
    throw new TypeError('operatingCase must be created by createResidentialIncomeOperatingCase');
  }

  const blockers = [];
  const evidenceGaps = [];
  const dueDiligence = [];
  const assumptions = [];
  const warnings = [];
  const lineageByRef = new Map((operatingCase.evidenceLineage || []).map((item) => [item.refId, item]));
  const requireLineageKind = (refId, expectedKind, code, field) => {
    if (!refId) return;
    const record = lineageByRef.get(refId);
    if (record && record.kind !== expectedKind) {
      addUnique(evidenceGaps, { code, field, refId, expected: expectedKind, actual: record.kind });
    }
  };

  for (const refId of collectOperatingCaseEvidenceRefs(operatingCase)) {
    if (!lineageByRef.has(refId)) {
      addUnique(evidenceGaps, { code: 'EVIDENCE_LINEAGE_REFERENCE_MISSING', field: null, refId });
    }
  }

  for (const value of evidenceAwareValuesForCase(operatingCase)) {
    checkLineageKind({ value, lineageByRef, evidenceGaps });
    switch (value.verificationStatus) {
      case OPERATING_INPUT_STATUS.CONFLICT:
        addUnique(blockers, { code: 'UNRESOLVED_MATERIAL_INPUT_CONFLICT', field: value.field, refId: value.sourceRef });
        break;
      case OPERATING_INPUT_STATUS.NOT_AVAILABLE:
        addUnique(evidenceGaps, { code: 'MATERIAL_INPUT_NOT_AVAILABLE', field: value.field, refId: null });
        break;
      case OPERATING_INPUT_STATUS.UNVERIFIED:
        addUnique(evidenceGaps, { code: 'MATERIAL_INPUT_UNVERIFIED', field: value.field, refId: value.sourceRef });
        break;
      case OPERATING_INPUT_STATUS.OBSERVED:
        addUnique(evidenceGaps, { code: 'VERIFIED_OR_EXPLICIT_ASSUMPTION_REQUIRED', field: value.field, refId: value.sourceRef });
        break;
      case OPERATING_INPUT_STATUS.VERIFIED_FACT:
        if (!value.adoptedForUnderwriting) {
          addUnique(evidenceGaps, { code: 'HUMAN_UNDERWRITING_ADOPTION_REQUIRED', field: value.field, refId: value.sourceRef });
        }
        break;
      case OPERATING_INPUT_STATUS.ASSUMED:
        if (!value.adoptedForUnderwriting) {
          addUnique(evidenceGaps, { code: 'ASSUMPTION_ADOPTION_REQUIRED', field: value.field, refId: null });
        } else {
          assumptions.push({
            field: value.field,
            reason: value.assumptionOverride.reason,
            approvedByRef: value.assumptionOverride.approvedByRef,
            policyRef: value.assumptionOverride.policyRef,
          });
        }
        break;
      default:
        addUnique(evidenceGaps, { code: 'UNKNOWN_INPUT_STATUS', field: value.field, refId: null });
    }
  }

  const interest = operatingCase.propertyInterest;
  if (!interest.interestEvidenceRef) {
    addUnique(evidenceGaps, { code: 'PROPERTY_INTEREST_EVIDENCE_REQUIRED', field: 'propertyInterest', refId: null });
  }
  if (!interest.interestAdoptionDecisionRef) {
    addUnique(evidenceGaps, { code: 'PROPERTY_INTEREST_ADOPTION_REQUIRED', field: 'propertyInterest', refId: null });
  }
  const interestEvidence = lineageByRef.get(interest.interestEvidenceRef);
  if (interestEvidence && !VALUE_SOURCE_LINEAGE_KINDS.includes(interestEvidence.kind)) {
    addUnique(evidenceGaps, {
      code: 'INVALID_PROPERTY_INTEREST_EVIDENCE_LINEAGE_KIND',
      field: 'propertyInterest',
      refId: interest.interestEvidenceRef,
      expected: 'source/evidence lineage',
      actual: interestEvidence.kind,
    });
  }
  requireLineageKind(interest.interestAdoptionDecisionRef, LINEAGE_KIND.UNDERWRITING_ADOPTION, 'INVALID_PROPERTY_INTEREST_ADOPTION_LINEAGE_KIND', 'propertyInterest');
  requireLineageKind(interest.titleAssessmentRef, LINEAGE_KIND.ANALYTICAL_ASSESSMENT, 'INVALID_TITLE_ASSESSMENT_LINEAGE_KIND', 'propertyInterest.titleAssessment');
  requireLineageKind(interest.legalReviewRef, LINEAGE_KIND.LEGAL_REVIEW, 'INVALID_LEGAL_REVIEW_LINEAGE_KIND', 'propertyInterest.legalReviewRef');
  if (!interest.titleAssessment) {
    addUnique(evidenceGaps, { code: 'TITLE_ASSESSMENT_REQUIRED', field: 'propertyInterest.titleAssessment', refId: interest.titleAssessmentRef });
  } else if (interest.titleAssessment.status === TITLE_RESULT_STATUS.HOLD_EVIDENCE) {
    addUnique(evidenceGaps, { code: 'TITLE_EVIDENCE_HOLD', field: 'propertyInterest.titleAssessment', refId: interest.titleAssessmentRef });
  } else if (interest.titleAssessment.status === TITLE_RESULT_STATUS.LEGAL_REVIEW_REQUIRED) {
    addUnique(dueDiligence, { code: 'TITLE_LEGAL_REVIEW_REQUIRED', field: 'propertyInterest.titleAssessment', refId: interest.titleAssessmentRef });
  }
  if (TIME_LIMITED_INTEREST_TYPES.includes(interest.interestType)) {
    if (!interest.commencementDate || !interest.expiryDate) {
      addUnique(evidenceGaps, { code: 'TIME_LIMITED_INTEREST_DATES_REQUIRED', field: 'propertyInterest', refId: interest.interestEvidenceRef });
    }
    if (!interest.legalReviewRef) {
      addUnique(dueDiligence, { code: 'TIME_LIMITED_INTEREST_LEGAL_REVIEW_REQUIRED', field: 'propertyInterest', refId: interest.interestEvidenceRef });
    }
  }

  if (operatingCase.units.length === 0) {
    addUnique(evidenceGaps, { code: 'RENTABLE_UNIT_INVENTORY_REQUIRED', field: 'units', refId: null });
  }

  const asOf = dateMs(operatingCase.asOfDate);
  for (const lease of operatingCase.leases) {
    if (!lease.termsEvidenceRef) {
      addUnique(evidenceGaps, { code: 'LEASE_TERMS_EVIDENCE_REQUIRED', field: `lease.${lease.leaseId}`, refId: null });
    }
    if (!lease.termsAdoptionDecisionRef) {
      addUnique(evidenceGaps, { code: 'LEASE_TERMS_ADOPTION_REQUIRED', field: `lease.${lease.leaseId}`, refId: null });
    }
    const termsEvidence = lineageByRef.get(lease.termsEvidenceRef);
    if (termsEvidence && !VALUE_SOURCE_LINEAGE_KINDS.includes(termsEvidence.kind)) {
      addUnique(evidenceGaps, {
        code: 'INVALID_LEASE_TERMS_EVIDENCE_LINEAGE_KIND',
        field: `lease.${lease.leaseId}`,
        refId: lease.termsEvidenceRef,
        expected: 'source/evidence lineage',
        actual: termsEvidence.kind,
      });
    }
    requireLineageKind(lease.termsAdoptionDecisionRef, LINEAGE_KIND.UNDERWRITING_ADOPTION, 'INVALID_LEASE_TERMS_ADOPTION_LINEAGE_KIND', `lease.${lease.leaseId}`);
    if (lease.lifecycleStatus === LEASE_LIFECYCLE_STATUS.UNKNOWN) {
      addUnique(evidenceGaps, { code: 'LEASE_LIFECYCLE_STATUS_REQUIRED', field: `lease.${lease.leaseId}`, refId: null });
      continue;
    }
    if (!lease.startDate || !lease.endDate) {
      addUnique(evidenceGaps, { code: 'LEASE_DATES_REQUIRED', field: `lease.${lease.leaseId}`, refId: null });
      continue;
    }
    const start = dateMs(lease.startDate);
    const end = dateMs(lease.endDate);
    if (lease.lifecycleStatus === LEASE_LIFECYCLE_STATUS.ACTIVE && (asOf < start || asOf >= end)) {
      addUnique(blockers, { code: 'ACTIVE_LEASE_DATE_CONTRADICTION', field: `lease.${lease.leaseId}`, refId: null });
    }
    if (lease.lifecycleStatus === LEASE_LIFECYCLE_STATUS.FUTURE && asOf >= start) {
      addUnique(blockers, { code: 'FUTURE_LEASE_DATE_CONTRADICTION', field: `lease.${lease.leaseId}`, refId: null });
    }
    if (lease.lifecycleStatus === LEASE_LIFECYCLE_STATUS.EXPIRED && asOf < end) {
      addUnique(blockers, { code: 'EXPIRED_LEASE_DATE_CONTRADICTION', field: `lease.${lease.leaseId}`, refId: null });
    }
  }

  for (const unit of operatingCase.units) {
    const activeLeases = operatingCase.leases.filter((lease) => lease.unitId === unit.unitId && lease.lifecycleStatus === LEASE_LIFECYCLE_STATUS.ACTIVE);
    const status = unit.operatingStatus.value;
    if (status === UNIT_OPERATING_STATUS.OCCUPIED && activeLeases.length === 0) {
      addUnique(blockers, { code: 'OCCUPIED_UNIT_WITHOUT_ACTIVE_LEASE', field: `unit.${unit.unitId}`, refId: null });
    }
    if (status === UNIT_OPERATING_STATUS.OCCUPIED && activeLeases.length > 1) {
      addUnique(blockers, { code: 'MULTIPLE_ACTIVE_LEASES_ON_UNIT', field: `unit.${unit.unitId}`, refId: null });
    }
    if ([UNIT_OPERATING_STATUS.VACANT, UNIT_OPERATING_STATUS.OFFLINE].includes(status) && activeLeases.length > 0) {
      addUnique(blockers, { code: 'NON_OCCUPIED_UNIT_HAS_ACTIVE_LEASE', field: `unit.${unit.unitId}`, refId: null });
    }
    if (status === UNIT_OPERATING_STATUS.UNKNOWN) {
      addUnique(evidenceGaps, { code: 'UNIT_OPERATING_STATUS_REQUIRED', field: `unit.${unit.unitId}`, refId: unit.operatingStatus.sourceRef });
    }
  }

  const activeTenantIds = new Set(operatingCase.leases
    .filter((lease) => lease.lifecycleStatus === LEASE_LIFECYCLE_STATUS.ACTIVE && lease.tenantId)
    .map((lease) => lease.tenantId));
  for (const tenant of operatingCase.tenants) {
    if (!activeTenantIds.has(tenant.tenantId)) continue;
    requireLineageKind(tenant.tenantAssessmentRef, LINEAGE_KIND.ANALYTICAL_ASSESSMENT, 'INVALID_TENANT_ASSESSMENT_LINEAGE_KIND', `tenant.${tenant.tenantId}`);
    if (!tenant.tenantAssessment) {
      addUnique(dueDiligence, { code: 'TENANT_ASSESSMENT_NOT_LINKED', field: `tenant.${tenant.tenantId}`, refId: tenant.tenantAssessmentRef });
      continue;
    }
    if (tenant.tenantAssessment.status === TENANT_RESULT_STATUS.HOLD_EVIDENCE) {
      addUnique(evidenceGaps, { code: 'TENANT_EVIDENCE_HOLD', field: `tenant.${tenant.tenantId}`, refId: tenant.tenantAssessmentRef });
    } else if ([
      TENANT_RESULT_STATUS.HOLD_POLICY,
      TENANT_RESULT_STATUS.LEGAL_REVIEW_REQUIRED,
      TENANT_RESULT_STATUS.TENANT_HIGH_RISK,
      TENANT_RESULT_STATUS.TENANT_ANALYTICAL_CONDITIONAL,
    ].includes(tenant.tenantAssessment.status)) {
      addUnique(dueDiligence, { code: 'TENANT_REVIEW_REQUIRED', field: `tenant.${tenant.tenantId}`, refId: tenant.tenantAssessmentRef });
    }
  }

  if (interest.expiryDate) {
    warnings.push({
      code: 'NO_FREEHOLD_TERMINAL_VALUE_INFERENCE',
      field: 'propertyInterest.expiryDate',
      refId: interest.interestEvidenceRef,
      note: 'The contract records an expiry but does not infer residual ownership or terminal value after expiry.',
    });
  }

  let status = OPERATING_UNDERWRITING_STATUS.READY_FOR_OPERATING_UNDERWRITING;
  if (blockers.length > 0) status = OPERATING_UNDERWRITING_STATUS.DECISION_BLOCKED;
  else if (evidenceGaps.length > 0) status = OPERATING_UNDERWRITING_STATUS.INSUFFICIENT_EVIDENCE;
  else if (dueDiligence.length > 0) status = OPERATING_UNDERWRITING_STATUS.NEEDS_DUE_DILIGENCE;
  else if (assumptions.length > 0) status = OPERATING_UNDERWRITING_STATUS.READY_WITH_ASSUMPTIONS;

  return deepFreeze({
    schemaVersion: 1,
    caseId: operatingCase.caseId,
    asOfDate: operatingCase.asOfDate,
    status,
    blockers,
    evidenceGaps,
    dueDiligence,
    assumptions,
    warnings,
    lineage: {
      declaredRefCount: operatingCase.evidenceLineage.length,
      requiredRefCount: collectOperatingCaseEvidenceRefs(operatingCase).length,
      missingRefCount: evidenceGaps.filter((item) => item.code === 'EVIDENCE_LINEAGE_REFERENCE_MISSING').length,
    },
    financialCalculationExecuted: false,
    investmentDecision: null,
    legalConclusion: null,
    prohibitedClaims: ['CERTIFIED_TITLE', 'LEGAL_CLEAR', 'CREDIT_RATING', 'APPROVE_INVESTMENT', 'REJECT_INVESTMENT'],
    semantics: 'Readiness is an operating-underwriting input gate only. It does not calculate NOI, value, returns, approve a tenant, provide legal advice, or authorize a transaction.',
  });
}

module.exports = {
  OPERATING_UNDERWRITING_STATUS,
  assessOperatingUnderwritingReadiness,
};
