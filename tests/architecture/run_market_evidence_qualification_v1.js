'use strict';

const assert = require('assert');
const {
  MARKET_USAGE,
  MARKET_EVIDENCE_STATUS: STATUS,
  qualifyMarketEvidence,
} = require('../../src/market-evidence/market-evidence-qualification');
const {
  EVIDENCE_GRADE,
  INPUT_STATUS,
} = require('../../src/valuation-intelligence/contracts');
const {
  QUALITY_STATUS,
  assessEvidenceQuality,
} = require('../../src/valuation-intelligence/evidence-quality');

function policy() {
  return {
    allowedCountries: ['Saudi Arabia'],
    allowedCities: ['Riyadh'],
    allowedAssetTypes: ['OFFICE'],
    maxAgeDaysByUsage: {
      [MARKET_USAGE.MARKET_RENT]: 180,
      [MARKET_USAGE.SALE_COMPARABLE]: 365,
      [MARKET_USAGE.CAP_RATE]: 180,
      [MARKET_USAGE.VACANCY]: 180,
      [MARKET_USAGE.OPEX]: 365,
      [MARKET_USAGE.CONSTRUCTION_COST]: 365,
      [MARKET_USAGE.LAND_PRICE]: 365,
      [MARKET_USAGE.EXIT_ASSUMPTION]: 180,
    },
    allowedGradesByUsage: Object.fromEntries(Object.values(MARKET_USAGE).map((usage) => [usage, [
      EVIDENCE_GRADE.A_VERIFIED_OFFICIAL,
      EVIDENCE_GRADE.B_VERIFIED_TRANSACTION,
      EVIDENCE_GRADE.C_CONTRACTUAL,
      EVIDENCE_GRADE.D_OPERATING_ACTUAL,
      EVIDENCE_GRADE.E_MARKET_OBSERVATION,
      EVIDENCE_GRADE.F_THIRD_PARTY_APPRAISAL,
    ]])),
    allowedStatusesByUsage: Object.fromEntries(Object.values(MARKET_USAGE).map((usage) => [usage, [INPUT_STATUS.VERIFIED, INPUT_STATUS.OBSERVED]])),
  };
}

function item(overrides = {}) {
  return {
    field: 'marketRentPerSqm',
    usage: MARKET_USAGE.MARKET_RENT,
    grade: EVIDENCE_GRADE.E_MARKET_OBSERVATION,
    status: INPUT_STATUS.OBSERVED,
    sourceType: 'MARKET_REPORT',
    sourceRef: 'source://market/rent/1',
    observedAt: '2026-08-15T00:00:00Z',
    geography: { country: 'Saudi Arabia', city: 'Riyadh', district: 'Olaya' },
    assetType: 'OFFICE',
    reviewerRef: 'reviewer://market-analyst/1',
    reviewedAt: '2026-08-20T00:00:00Z',
    ...overrides,
  };
}

function base() {
  return {
    caseId: 'CASE-MKT-001',
    projectId: 'PROJECT-MKT-001',
    asOfDate: '2026-09-01T00:00:00Z',
    targetGeography: { country: 'Saudi Arabia', city: 'Riyadh', district: 'Olaya' },
    targetAssetType: 'OFFICE',
    items: [
      item(),
      item({
        field: 'salePricePerSqm',
        usage: MARKET_USAGE.SALE_COMPARABLE,
        grade: EVIDENCE_GRADE.B_VERIFIED_TRANSACTION,
        status: INPUT_STATUS.VERIFIED,
        sourceType: 'VERIFIED_TRANSACTION',
        sourceRef: 'source://market/sale/1',
        observedAt: '2026-07-01T00:00:00Z',
      }),
    ],
    policy: policy(),
  };
}

let checks = 0;
function check(name, fn) {
  fn();
  checks += 1;
  console.log(`PASS ${name}`);
}

check('qualified market evidence preserves provenance and bounded semantics', () => {
  const result = qualifyMarketEvidence(base());
  assert.strictEqual(result.status, STATUS.QUALIFIED_FOR_ANALYTICAL_USE);
  assert.strictEqual(result.analyticalUseAllowed, true);
  assert.strictEqual(result.externalMarketTruthEstablished, false);
  assert.strictEqual(result.certifiedValuationEstablished, false);
  assert.strictEqual(result.humanReviewRequired, true);
  assert.strictEqual(result.qualifiedEvidence.length, 2);
  assert.strictEqual(result.evidenceRecords.length, 2);
});

check('policy is mandatory and thresholds are not invented', () => {
  const input = base();
  input.policy = null;
  assert.strictEqual(qualifyMarketEvidence(input).status, STATUS.HOLD_POLICY);
});

check('stale evidence fails closed', () => {
  const input = base();
  input.items = [item({ observedAt: '2025-01-01T00:00:00Z' })];
  assert.strictEqual(qualifyMarketEvidence(input).status, STATUS.HOLD_STALE);
});

check('future-dated evidence fails freshness check', () => {
  const input = base();
  input.items = [item({ observedAt: '2026-10-01T00:00:00Z' })];
  assert.strictEqual(qualifyMarketEvidence(input).status, STATUS.HOLD_STALE);
});

check('geography mismatch fails closed', () => {
  const input = base();
  input.items = [item({ geography: { country: 'Saudi Arabia', city: 'Jeddah' } })];
  assert.strictEqual(qualifyMarketEvidence(input).status, STATUS.HOLD_GEOGRAPHY);
});

check('asset-type mismatch fails closed', () => {
  const input = base();
  input.items = [item({ assetType: 'WAREHOUSE' })];
  assert.strictEqual(qualifyMarketEvidence(input).status, STATUS.HOLD_ASSET_TYPE);
});

check('review provenance is mandatory', () => {
  const input = base();
  input.items = [item({ reviewerRef: '' })];
  assert.strictEqual(qualifyMarketEvidence(input).status, STATUS.HOLD_REVIEW);
});

check('conflicting evidence has highest hold precedence', () => {
  const input = base();
  input.items = [item({ status: INPUT_STATUS.CONFLICT })];
  assert.strictEqual(qualifyMarketEvidence(input).status, STATUS.HOLD_CONFLICT);
});

check('low-grade assumptions can be disallowed by caller policy', () => {
  const input = base();
  input.items = [item({ grade: EVIDENCE_GRADE.G_EXPERT_ASSUMPTION, status: INPUT_STATUS.ASSUMED })];
  assert.strictEqual(qualifyMarketEvidence(input).status, STATUS.HOLD_EVIDENCE_QUALITY);
});

check('qualified market records feed existing valuation evidence-quality gate', () => {
  const market = qualifyMarketEvidence(base());
  const quality = assessEvidenceQuality({
    evidence: market.evidenceRecords,
    policy: {
      minEvidenceCount: 2,
      maxAssumptionBurdenRatio: 0,
      maxLowGradeRatio: 0,
    },
    criticalRequirements: [
      {
        field: 'marketRentPerSqm',
        allowedGrades: [EVIDENCE_GRADE.E_MARKET_OBSERVATION],
        allowedStatuses: [INPUT_STATUS.OBSERVED],
      },
      {
        field: 'salePricePerSqm',
        allowedGrades: [EVIDENCE_GRADE.B_VERIFIED_TRANSACTION],
        allowedStatuses: [INPUT_STATUS.VERIFIED],
      },
    ],
  });
  assert.strictEqual(quality.status, QUALITY_STATUS.QUALIFIED);
});

console.log(`MARKET_EVIDENCE_QUALIFICATION_V1=PASS checks=${checks}`);
