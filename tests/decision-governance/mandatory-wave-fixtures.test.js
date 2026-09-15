'use strict';

const assert = require('assert');
const { evaluateOverallDecisionGate } = require('../../src/decision-governance/overall-decision-gate');
const { calculateSaudiAcquisitionCosts } = require('../../src/decision-governance/saudi-acquisition-costs');
const { evaluateEvidenceReadiness } = require('../../src/decision-governance/evidence-readiness');
const { createDemoWorkspace, prepareWorkspaceRecordForSave } = require('../../src/decision-governance/deal-workspace-controller');

const base = {
  modelVersion: 'decision-governance-v1', financialDecision: 'PASS', valuationReadiness: 'READY',
  evidenceReadiness: 'SUFFICIENT_FOR_IC', legalStatus: 'PASS', regulatoryStatus: 'PASS', technicalStatus: 'PASS',
  financingStatus: 'NOT_APPLICABLE', criticalRiskFlags: [], requiredApprovals: [], missingEvidence: [],
};

// CASE-01 positive financial result + incomplete DD => never final approval.
let d = evaluateOverallDecisionGate({ ...base, legalStatus: 'PENDING' });
assert.strictEqual(d.status, 'DUE_DILIGENCE_REQUIRED');
assert.strictEqual(d.financialPassIsInvestmentApproval, false);

// CASE-02 negative NPV represented by financial FAIL => reject; no transaction authority.
d = evaluateOverallDecisionGate({ ...base, financialDecision: 'FAIL' });
assert.strictEqual(d.status, 'REJECT');
assert.strictEqual(d.transactionAuthorized, false);

// CASE-03 insufficient evidence => not READY_FOR_IC.
d = evaluateOverallDecisionGate({ ...base, evidenceReadiness: 'INSUFFICIENT' });
assert.notStrictEqual(d.status, 'READY_FOR_IC');

// CASE-04 legal unresolved => not READY_FOR_IC.
d = evaluateOverallDecisionGate({ ...base, legalStatus: 'UNRESOLVED' });
assert.notStrictEqual(d.status, 'READY_FOR_IC');

// CASE-05 weak DSCR is represented by financing hard-gate FAIL.
d = evaluateOverallDecisionGate({ ...base, financingStatus: 'FAIL' });
assert.strictEqual(d.status, 'DUE_DILIGENCE_REQUIRED');

// CASE-06 RETT seller borne => no buyer acquisition basis addition.
let c = calculateSaudiAcquisitionCosts({ purchasePrice: 1000000, rettRate: 0.05, rettEconomicBearer: 'SELLER', rettIncludedInAcquisitionBasis: true });
assert.strictEqual(c.rett.buyerEconomicAmount, 0);
assert.strictEqual(c.acquisitionBasis, 1000000);

// CASE-07 RETT buyer borne => included in buyer basis.
c = calculateSaudiAcquisitionCosts({ purchasePrice: 1000000, rettRate: 0.05, rettEconomicBearer: 'BUYER', rettIncludedInAcquisitionBasis: true });
assert.strictEqual(c.rett.buyerEconomicAmount, 50000);
assert.strictEqual(c.acquisitionBasis, 1050000);

// CASE-08 brokerage seller borne => no buyer acquisition basis addition.
c = calculateSaudiAcquisitionCosts({ purchasePrice: 1000000, brokerageRate: 0.025, brokeragePayer: 'SELLER', brokerageIncludedInAcquisitionBasis: true });
assert.strictEqual(c.brokerage.buyerEconomicAmount, 0);
assert.strictEqual(c.acquisitionBasis, 1000000);

// CASE-09 brokerage unknown => warning + no automatic buyer charge.
c = calculateSaudiAcquisitionCosts({ purchasePrice: 1000000, brokerageRate: 0.025, brokeragePayer: 'UNKNOWN', brokerageIncludedInAcquisitionBasis: true });
assert.strictEqual(c.brokerage.buyerEconomicAmount, 0);
assert.strictEqual(c.acquisitionBasis, 1000000);
assert.ok(c.warnings.includes('BROKERAGE_PAYER_UNKNOWN_NO_BUYER_CHARGE_ASSUMED'));

// CASE-10 missing Exit Cap is fail-closed at the overall gate when valuation readiness is incomplete.
d = evaluateOverallDecisionGate({ ...base, valuationReadiness: 'INCOMPLETE' });
assert.strictEqual(d.status, 'DUE_DILIGENCE_REQUIRED');

// CASE-11 Demo is explicitly identified and cannot save as a real deal without confirmation.
const demo = createDemoWorkspace('building', { projectTitle: 'Sample', buildingPrice: 1000000 });
assert.strictEqual(demo.provenance.isDemo, true);
assert.throws(() => prepareWorkspaceRecordForSave({ id: 'demo', mode: 'building', inputs: demo.inputs }, demo.provenance),
  (error) => error && error.code === 'DEMO_REAL_DEAL_CONFIRMATION_REQUIRED');

// CASE-12 stale evidence downgrades readiness.
const e = evaluateEvidenceReadiness({ sources: [{ source: 'registry', sourceDate: '2025-01-01' }], freshnessStatus: 'STALE' });
assert.strictEqual(e.status, 'STALE');

console.log('MANDATORY_WAVE_FIXTURES_CASE_01_TO_12=PASS');
