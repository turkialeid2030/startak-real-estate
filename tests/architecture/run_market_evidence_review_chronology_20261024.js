'use strict';

const assert = require('node:assert/strict');
const {
  qualifyMarketEvidence, MARKET_USAGE, MARKET_EVIDENCE_STATUS: STATUS
} = require('../../src/market-evidence/market-evidence-qualification');
const { EVIDENCE_GRADE: GRADE, INPUT_STATUS: INPUT } = require('../../src/valuation-intelligence/contracts');

function input(overrides = {}) {
  const usage = MARKET_USAGE.MARKET_RENT;
  return {
    caseId: 'SYNTHETIC-CASE', projectId: 'SYNTHETIC-PROJECT',
    asOfDate: '2026-09-01T00:00:00Z',
    targetGeography: {country:'Saudi Arabia', city:'Riyadh'},
    targetAssetType: 'OFFICE',
    items: [{
      field: 'marketRentPerSqm', usage,
      grade: GRADE.E_MARKET_OBSERVATION, status: INPUT.OBSERVED,
      sourceType: 'SYNTHETIC_TEST', sourceRef: 'test://market-rent',
      observedAt: '2026-08-15T00:00:00Z',
      reviewerRef: 'synthetic-reviewer',
      reviewedAt: '2026-08-20T00:00:00Z',
      geography: {country:'Saudi Arabia',city:'Riyadh'},
      assetType: 'OFFICE',...overrides
    }],
    policy: {
      maxAgeDaysByUsage: {[usage]: 180},
      allowedGradesByUsage: {[usage]: [GRADE.E_MARKET_OBSERVATION]},
      allowedStatusesByUsage: {[usage]: [INPUT.OBSERVED]},
    }
  };
}
const normal=qualifyMarketEvidence(input());
assert.equal(normal.status, STATUS.QUALIFIED_FOR_ANALYTICAL_USE);
assert.equal(normal.analyticalUseAllowed,true);
assert.equal(normal.officialSourceAuthenticationEstablished,false);
assert.equal(normal.sourceUsageRightsEstablished,false);
const earlier=qualifyMarketEvidence(input({reviewedAt:'2026-08-14T23:59:59Z'}));
assert.equal(earlier.status,STATUS.HOLD_REVIEW);
assert.equal(earlier.failures[0].detail,'REVIEW_BEFORE_OBSERVATION');
assert.equal(earlier.analyticalUseAllowed,false);
const later=qualifyMarketEvidence(input({reviewedAt:'2026-09-02T00:00:00Z'}));
assert.equal(later.status,STATUS.HOLD_REVIEW);
assert.equal(later.failures[0].detail,'REVIEW_AFTER_AS_OF_DATE');
assert.equal(later.analyticalUseAllowed,false);
const exact=qualifyMarketEvidence(input({reviewedAt:'2026-09-01T00:00:00Z'}));
assert.equal(exact.status,STATUS.QUALIFIED_FOR_ANALYTICAL_USE);
const sameObservation=qualifyMarketEvidence(input({reviewedAt:'2026-08-15T00:00:00Z'}));
assert.equal(sameObservation.status,STATUS.QUALIFIED_FOR_ANALYTICAL_USE);
const futureObservation=qualifyMarketEvidence(input({observedAt:'2026-09-02T00:00:00Z',reviewedAt:'2026-09-03T00:00:00Z'}));
assert.equal(futureObservation.status,STATUS.HOLD_STALE);
const invalid=qualifyMarketEvidence(input({reviewedAt:'NOT_A_DATE'}));
assert.equal(invalid.status,STATUS.HOLD_REVIEW);
assert.equal(invalid.officialSourceAuthenticationEstablished,false);
const mixed=input();
mixed.items.push({...mixed.items[0],field:'marketVacancyRate',reviewedAt:'2026-09-12T00:00:00Z'});
const mixedResult=qualifyMarketEvidence(mixed);
assert.equal(mixedResult.status,STATUS.HOLD_REVIEW);
assert.equal(mixedResult.analyticalUseAllowed,false);
assert.equal(mixedResult.qualifiedEvidence.length,1);
assert.equal(mixedResult.sourceUsageRightsEstablished,false);
console.log('MARKET_EVIDENCE_REVIEW_CHRONOLOGY=PASS checks=19');
