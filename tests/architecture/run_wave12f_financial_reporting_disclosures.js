'use strict';

const assert = require('assert');
const { sha256 } = require('../../src/standards/standards-registry');
const {
  REGULATED_DOMAIN,
  AUTHORITY_ROLE,
  routeRegulatedContexts,
} = require('../../src/standards/regulated-context-router');
const {
  FINANCIAL_REPORTING_DISCLOSURE_STATUS,
  DISCLOSURE_TOPIC,
  DISCLOSURE_DECISION,
  CLAIM_NATURE,
  createDisclosureRecord,
  verifyDisclosureRecordIntegrity,
  createValuationReference,
  verifyValuationReferenceIntegrity,
  buildFinancialReportingDisclosurePacket,
  verifyFinancialReportingDisclosurePacketIntegrity,
} = require('../../src/reporting/financial-reporting-disclosure-packet');

let checks = 0;
function check(value, message) { assert.ok(value, message); checks += 1; }
function equal(actual, expected, message) { assert.strictEqual(actual, expected, message); checks += 1; }
function throws(fn, re, message) { assert.throws(fn, re, message); checks += 1; }

const routeContext = Object.freeze({
  jurisdiction: 'SAUDI_ARABIA',
  valuation_purpose: 'FINANCIAL_REPORTING',
  intended_use: 'INSTITUTIONAL_REPORTING',
  intended_user: 'BOARD_AND_AUDITOR',
  asset_type: 'INVESTMENT_PROPERTY',
  reporting_framework: 'IFRS_SOCPA',
  regulated_entity_status: null,
  transaction_context: null,
  financing_context: null,
  as_of_date: '2026-09-01T00:00:00.000Z',
});

function standard(id, version = '2026', status = 'ACTIVE') {
  return Object.freeze({ standard_id: id, version, status });
}

function makeRoute() {
  const selected = Object.freeze([
    standard('IFRS-FR-001'),
    standard('SOCPA-ADOPTION-001'),
  ]);
  const selectedRuleset = selected.map((item) => `${item.standard_id}@${item.version}`).sort();
  const payload = { schema_version: 1, context: routeContext, selected_ruleset: selectedRuleset };
  return Object.freeze({
    ...payload,
    route_hash: sha256(payload),
    selected_standards: selected,
    standards_snapshot: Object.freeze({
      standards_snapshot_version: 'b'.repeat(64),
      selected: Object.freeze(selected.map((item) => ({ standard_id: item.standard_id, version: item.version, status: item.status }))),
    }),
  });
}

function makeRegulatedContext({ financialReportingRequired = true } = {}) {
  return routeRegulatedContexts({
    regulatedContextId: financialReportingRequired ? 'REGCTX-12F' : 'REGCTX-12F-NA',
    standardsRoute: makeRoute(),
    financialReportingRequired,
    financialReportingFramework: financialReportingRequired ? 'IFRS_SOCPA' : null,
    cmaRegulatedContext: false,
    samaRegulatedFinancingContext: false,
    bindings: financialReportingRequired ? [
      {
        domain: REGULATED_DOMAIN.FINANCIAL_REPORTING,
        standardId: 'IFRS-FR-001',
        authorityRole: AUTHORITY_ROLE.FINANCIAL_REPORTING_STANDARD,
        rationale: 'Reviewed reporting framework binding',
        evidenceRef: 'EVID-IFRS',
      },
      {
        domain: REGULATED_DOMAIN.FINANCIAL_REPORTING,
        standardId: 'SOCPA-ADOPTION-001',
        authorityRole: AUTHORITY_ROLE.LOCAL_ACCOUNTING_ADOPTION,
        rationale: 'Reviewed local adoption binding',
        evidenceRef: 'EVID-SOCPA',
      },
    ] : [],
    preparedByRef: 'VALUATION-TEAM',
    preparedAt: '2026-09-02T09:00:00.000Z',
    reviewedByRef: 'ACCOUNTING-REVIEWER',
    reviewedAt: '2026-09-02T11:00:00.000Z',
    reviewEvidenceRef: 'REGCTX-REVIEW',
  });
}

function disclosure(id = 'DISC-001', overrides = {}) {
  return createDisclosureRecord({
    disclosureId: id,
    topic: DISCLOSURE_TOPIC.FAIR_VALUE_MEASUREMENT,
    decision: DISCLOSURE_DECISION.DISCLOSURE_REQUIRED,
    claimNature: CLAIM_NATURE.REPORTING_DISCLOSURE,
    statement: 'Professionally reviewed disclosure position for the reporting draft.',
    rationale: 'Reporting treatment must be supported by the selected active standards and reviewer evidence.',
    standardIds: ['IFRS-FR-001', 'SOCPA-ADOPTION-001'],
    evidenceRefs: ['EVID-DISC-001'],
    asOfDate: '2026-09-01T00:00:00.000Z',
    preparedByRef: 'ACCOUNTING-ANALYST',
    preparedAt: '2026-09-03T09:00:00.000Z',
    reviewedByRef: 'ACCOUNTING-REVIEWER',
    reviewedAt: '2026-09-03T11:00:00.000Z',
    reviewEvidenceRef: `REVIEW-${id}`,
    ...overrides,
  });
}

function valuationReference(id = 'VALREF-001', overrides = {}) {
  return createValuationReference({
    referenceId: id,
    method: 'PROFESSIONAL_DCF_VALUE_INDICATION',
    valueIndicationSar: 10000000,
    calculationHashSha256: 'c'.repeat(64),
    valuationDate: '2026-09-01T00:00:00.000Z',
    sourceRef: 'WAVE12C-DCF-RESULT',
    evidenceRefs: ['EVID-DCF-RESULT'],
    ...overrides,
  });
}

function build(overrides = {}) {
  return buildFinancialReportingDisclosurePacket({
    packetId: 'FRD-12F-001',
    caseId: 'CASE-12F-001',
    propertyRef: 'PROPERTY-12F-001',
    valuationDate: '2026-09-01T00:00:00.000Z',
    reportDate: '2026-09-03T00:00:00.000Z',
    regulatedContextResult: makeRegulatedContext(),
    disclosures: [disclosure()],
    valuationReferences: [valuationReference()],
    preparedByRef: 'REPORTING-TEAM',
    preparedAt: '2026-09-04T09:00:00.000Z',
    reviewedByRef: 'ACCOUNTING-REVIEWER',
    reviewedAt: '2026-09-04T12:00:00.000Z',
    reviewEvidenceRef: 'PACKET-REVIEW-12F',
    ...overrides,
  });
}

const disc = disclosure();
check(verifyDisclosureRecordIntegrity(disc), 'disclosure record integrity');
const valRef = valuationReference();
check(verifyValuationReferenceIntegrity(valRef), 'valuation reference integrity');

const packet = build();
equal(packet.status, FINANCIAL_REPORTING_DISCLOSURE_STATUS.READY_FOR_REPORT_DRAFT, 'packet ready for later report drafting');
check(verifyFinancialReportingDisclosurePacketIntegrity(packet), 'packet integrity');
equal(packet.reportDraftAllowed, true, 'report draft handoff allowed');
equal(packet.professionalAccountingReviewRecorded, true, 'professional accounting review recorded');
equal(packet.valuationReferencesRecalculated, false, 'valuation references are never recalculated');
equal(packet.valuationArithmeticMutationAllowed, false, 'reporting packet cannot change valuation arithmetic');
equal(packet.professionalValueIndicationMutable, false, 'professional value indication immutable');
equal(packet.accountingTreatmentAutomaticallyApplied, false, 'no automatic accounting treatment');
equal(packet.financialReportingComplianceEstablished, false, 'no compliance claim');
equal(packet.legalConclusionEstablished, false, 'no legal conclusion');
equal(packet.certifiedValuationEstablished, false, 'no certified valuation');
equal(packet.transactionAuthorized, false, 'no transaction authority');
equal(packet.financialReportingStandardIds.length, 2, 'bound financial-reporting standards retained');
equal(packet.disclosures.length, 1, 'reviewed disclosure retained');
equal(packet.valuationReferences.length, 1, 'immutable valuation reference retained');

const tamperedDisclosure = { ...disc, statement: 'tampered' };
equal(build({ disclosures: [tamperedDisclosure] }).status, FINANCIAL_REPORTING_DISCLOSURE_STATUS.HOLD_INTEGRITY, 'tampered disclosure blocked');

const tamperedRef = { ...valRef, valueIndicationSar: 999 };
equal(build({ valuationReferences: [tamperedRef] }).status, FINANCIAL_REPORTING_DISCLOSURE_STATUS.HOLD_INTEGRITY, 'tampered valuation reference blocked');

const badStandard = disclosure('DISC-BAD-STD', { standardIds: ['NOT-BOUND-STD'] });
const badStandardPacket = build({ disclosures: [badStandard] });
equal(badStandardPacket.status, FINANCIAL_REPORTING_DISCLOSURE_STATUS.HOLD_DISCLOSURES, 'disclosure cannot cite standard outside financial reporting gate');
check(badStandardPacket.blockers.some((item) => item.includes('DISCLOSURE_STANDARD_NOT_BOUND_TO_FINANCIAL_REPORTING_GATE')), 'unbound standard blocker explicit');

const duplicate = build({ disclosures: [disc, disc] });
equal(duplicate.status, FINANCIAL_REPORTING_DISCLOSURE_STATUS.HOLD_DISCLOSURES, 'duplicate disclosure id blocked');
check(duplicate.blockers.some((item) => item.startsWith('DUPLICATE_DISCLOSURE_ID:')), 'duplicate disclosure blocker explicit');

const mismatchedRef = valuationReference('VALREF-DATE', { valuationDate: '2026-08-31T00:00:00.000Z' });
const mismatchedRefPacket = build({ valuationReferences: [mismatchedRef] });
equal(mismatchedRefPacket.status, FINANCIAL_REPORTING_DISCLOSURE_STATUS.HOLD_DISCLOSURES, 'valuation reference date mismatch blocked');
check(mismatchedRefPacket.blockers.includes('VALUATION_REFERENCE_DATE_MISMATCH:VALREF-DATE'), 'valuation reference mismatch explicit');

const noDisclosures = build({ disclosures: [] });
equal(noDisclosures.status, FINANCIAL_REPORTING_DISCLOSURE_STATUS.HOLD_DISCLOSURES, 'financial reporting applicable requires reviewed disclosure content');
check(noDisclosures.blockers.includes('AT_LEAST_ONE_REVIEWED_DISCLOSURE_REQUIRED'), 'missing disclosure blocker explicit');

const nonApplicableContext = makeRegulatedContext({ financialReportingRequired: false });
const notApplicable = buildFinancialReportingDisclosurePacket({
  packetId: 'FRD-NA',
  caseId: 'CASE-NA',
  propertyRef: 'PROPERTY-NA',
  valuationDate: '2026-09-01T00:00:00.000Z',
  reportDate: '2026-09-03T00:00:00.000Z',
  regulatedContextResult: nonApplicableContext,
  disclosures: [],
  valuationReferences: [],
  preparedByRef: 'TEAM',
  preparedAt: '2026-09-04T09:00:00.000Z',
  reviewedByRef: 'REVIEWER',
  reviewedAt: '2026-09-04T10:00:00.000Z',
  reviewEvidenceRef: 'NA-REVIEW',
});
equal(notApplicable.status, FINANCIAL_REPORTING_DISCLOSURE_STATUS.NOT_APPLICABLE, 'non-applicable financial reporting context stays explicit');
check(verifyFinancialReportingDisclosurePacketIntegrity(notApplicable), 'not-applicable packet integrity');
equal(notApplicable.reportDraftAllowed, false, 'no financial-reporting draft handoff when not applicable');

const strayContent = buildFinancialReportingDisclosurePacket({
  packetId: 'FRD-NA-CONTENT',
  caseId: 'CASE-NA',
  propertyRef: 'PROPERTY-NA',
  valuationDate: '2026-09-01T00:00:00.000Z',
  reportDate: '2026-09-03T00:00:00.000Z',
  regulatedContextResult: nonApplicableContext,
  disclosures: [disc],
  valuationReferences: [],
  preparedByRef: 'TEAM',
  preparedAt: '2026-09-04T09:00:00.000Z',
  reviewedByRef: 'REVIEWER',
  reviewedAt: '2026-09-04T10:00:00.000Z',
  reviewEvidenceRef: 'NA-REVIEW',
});
equal(strayContent.status, FINANCIAL_REPORTING_DISCLOSURE_STATUS.HOLD_DISCLOSURES, 'content cannot silently create financial reporting applicability');

const tamperedContext = { ...makeRegulatedContext(), financialReportingFramework: 'OTHER' };
equal(build({ regulatedContextResult: tamperedContext }).status, FINANCIAL_REPORTING_DISCLOSURE_STATUS.HOLD_REGULATED_CONTEXT, 'tampered regulated context blocked');

const tamperedPacket = { ...packet, reportDate: '2026-09-05T00:00:00.000Z' };
equal(verifyFinancialReportingDisclosurePacketIntegrity(tamperedPacket), false, 'tampered packet fails integrity');

throws(() => createDisclosureRecord({
  disclosureId: 'BAD-DATE', topic: DISCLOSURE_TOPIC.OTHER, decision: DISCLOSURE_DECISION.PROFESSIONAL_POSITION_RECORDED,
  claimNature: CLAIM_NATURE.ACCOUNTING_JUDGMENT, statement: 'x', rationale: 'x', standardIds: ['IFRS-FR-001'],
  evidenceRefs: ['E'], asOfDate: '2026-09-04T00:00:00.000Z', preparedByRef: 'P', preparedAt: '2026-09-03T00:00:00.000Z',
  reviewedByRef: 'R', reviewedAt: '2026-09-03T01:00:00.000Z', reviewEvidenceRef: 'RE',
}), /DISCLOSURE_PREPARATION_BEFORE_AS_OF_DATE/, 'disclosure preparation cannot precede as-of date');

throws(() => build({ reportDate: '2026-08-31T00:00:00.000Z' }), /REPORT_DATE_BEFORE_VALUATION_DATE/, 'report date cannot precede valuation date');

console.log(`WAVE_12F_FINANCIAL_REPORTING_DISCLOSURES=PASS checks=${checks}`);
