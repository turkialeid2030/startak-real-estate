'use strict';
const assert = require('assert');
const { STATUS, buildPortfolioIntelligence } = require('../../src/portfolio-intelligence');
let checks = 0;
function check(fn) { fn(); checks++; }

const policy = { moderateHhi: 0.35, highHhi: 0.55 };
const base = buildPortfolioIntelligence({
  portfolioId: 'PF-1',
  concentrationPolicy: policy,
  holdings: [
    { holdingId: 'H1', projectId: 'P1', exposure: 40, assetClass: 'OFFICE', geography: 'RIYADH', strategy: 'CORE', evidenceReady: true, decisionReliability: 'HIGH' },
    { holdingId: 'H2', projectId: 'P2', exposure: 30, assetClass: 'INDUSTRIAL', geography: 'RIYADH', strategy: 'CORE_PLUS', evidenceReady: true, decisionReliability: 'MODERATE' },
    { holdingId: 'H3', projectId: 'P3', exposure: 30, assetClass: 'INDUSTRIAL', geography: 'JEDDAH', strategy: 'CORE_PLUS', evidenceReady: true, professionalReviewRequired: true },
  ],
});
check(() => assert.strictEqual(base.status, STATUS.READY));
check(() => assert.strictEqual(base.totalExposure, 100));
check(() => assert.strictEqual(base.holdingCount, 3));
check(() => assert.strictEqual(base.exposures.assetClass[0].bucket, 'INDUSTRIAL'));
check(() => assert.strictEqual(base.exposures.assetClass[0].share, 0.6));
check(() => assert.ok(Math.abs(base.concentrationHhi.assetClass - 0.52) < 1e-12));
check(() => assert.strictEqual(base.concentration.assetClass, 'MODERATE'));
check(() => assert.strictEqual(base.concentration.geography, 'MODERATE'));
check(() => assert.strictEqual(base.professionalReviewCount, 1));
check(() => assert.strictEqual(base.unassessedReliabilityCount, 1));
check(() => assert.strictEqual(base.maxSingleHoldingShare, 0.4));
check(() => assert.strictEqual(base.optimizerUsed, false));
check(() => assert.strictEqual(base.correlationsAssumed, false));

const noPolicy = buildPortfolioIntelligence({
  portfolioId: 'PF-2',
  holdings: [{ holdingId: 'H1', projectId: 'P1', exposure: 10, evidenceReady: true }],
});
check(() => assert.strictEqual(noPolicy.status, STATUS.HOLD_POLICY));
check(() => assert.ok(noPolicy.reasonCodes.includes('CONCENTRATION_POLICY_NOT_SUPPLIED')));
check(() => assert.strictEqual(noPolicy.concentration.assetClass, 'NOT_ASSESSED'));

const evidenceHold = buildPortfolioIntelligence({
  portfolioId: 'PF-3',
  concentrationPolicy: policy,
  holdings: [{ holdingId: 'H1', projectId: 'P1', exposure: 10, evidenceReady: false }],
});
check(() => assert.strictEqual(evidenceHold.status, STATUS.HOLD_EVIDENCE));
check(() => assert.strictEqual(evidenceHold.evidenceGapCount, 1));

const zero = buildPortfolioIntelligence({
  portfolioId: 'PF-4', concentrationPolicy: policy,
  holdings: [{ holdingId: 'H1', projectId: 'P1', exposure: 0, evidenceReady: true }],
});
check(() => assert.strictEqual(zero.status, STATUS.HOLD_EVIDENCE));
check(() => assert.ok(zero.reasonCodes.includes('ZERO_TOTAL_EXPOSURE')));

check(() => assert.throws(() => buildPortfolioIntelligence({
  portfolioId: 'PF-DUP', concentrationPolicy: policy,
  holdings: [{ holdingId: 'H1', projectId: 'P1', exposure: 10 }, { holdingId: 'H1', projectId: 'P2', exposure: 20 }],
}), /DUPLICATE_HOLDING_ID/));
check(() => assert.throws(() => buildPortfolioIntelligence({
  portfolioId: 'PF-BAD', concentrationPolicy: { moderateHhi: 0.6, highHhi: 0.5 },
  holdings: [{ holdingId: 'H1', projectId: 'P1', exposure: 10 }],
}), /invalid concentration policy/));

console.log(`PORTFOLIO_INTELLIGENCE_V1: PASS (${checks} checks)`);
