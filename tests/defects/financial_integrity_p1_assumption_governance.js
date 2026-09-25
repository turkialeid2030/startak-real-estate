'use strict';

const { validateSavedDealRecord, SavedDealValidationError } = require('../../src/validation/saved-deal-schema');
const { legacySavedDealToInvestmentCase } = require('../../src/migrations/legacy-saved-deal-adapter');
const {
  SAVED_DEAL_ASSUMPTION_REGISTRY_VERSION,
  withAssumptionRegistry,
  evaluateSavedDealAssumptionRegistry,
} = require('../../src/assumptions/saved-deal-assumption-registry');
const gold = require('../reference/RE-GOLD-baseline.json');

const results = [];
function check(id, condition, detail) {
  console.log(`${id} ${condition ? 'PASS' : 'FAIL'} -- ${detail}`);
  results.push(Boolean(condition));
}

const B = gold['RE-GOLD-002_existing_building'].inputs;
const legacyRecord = {
  id: 'p1-legacy',
  name: 'Legacy Building',
  mode: 'building',
  inputs: B,
  savedAt: '2026-09-25T00:00:00.000Z',
};

check('P1-LEGACY-ABSENCE-VALID', (() => {
  try { validateSavedDealRecord(legacyRecord); return true; } catch (_) { return false; }
})(), 'absence of assumptionRegistry remains backward compatible');

const legacyCase = legacySavedDealToInvestmentCase(legacyRecord);
check('P1-LEGACY-NOT-AUTO-MIGRATED',
  legacyCase.legacyMetadata.assumptionRegistryPresent === false
    && legacyCase.decision.status === 'NOT_EVALUATED',
  'legacy record remains screening-only and is not auto-migrated');

const supportedRegistry = [{
  id: 'market-cap-rate',
  label: 'Market capitalization rate',
  value: 0.08,
  unit: 'ratio',
  critical: true,
  sourceType: 'MARKET_COMPARABLES',
  sourceReference: 'P1-test-evidence-001',
  sourceDate: '2026-09-25T00:00:00.000Z',
  evidenceCount: 4,
  confidence: 'HIGH',
  owner: 'investment-team',
  reviewer: 'model-risk',
  expiresAt: '2099-12-31T00:00:00.000Z',
}];

const beforeLegacyJson = JSON.stringify(legacyRecord);
const governedRecord = withAssumptionRegistry(legacyRecord, supportedRegistry);
check('P1-WITH-REGISTRY-NON-DESTRUCTIVE',
  JSON.stringify(legacyRecord) === beforeLegacyJson
    && governedRecord !== legacyRecord
    && governedRecord.assumptionRegistryVersion === SAVED_DEAL_ASSUMPTION_REGISTRY_VERSION,
  'registry attachment is additive and non-destructive');

check('P1-SUPPORTED-REGISTRY-STRUCTURAL-VALID', (() => {
  try { validateSavedDealRecord(governedRecord); return true; } catch (_) { return false; }
})(), 'supported registry persists as top-level governance metadata');

const governedEvaluation = evaluateSavedDealAssumptionRegistry(governedRecord, { asOf: '2026-09-25T00:00:00.000Z' });
check('P1-SUPPORTED-REGISTRY-PASS',
  governedEvaluation.status === 'PASS'
    && typeof governedEvaluation.registryHashSha256 === 'string'
    && governedEvaluation.registryHashSha256.length === 64,
  `status=${governedEvaluation.status}`);

const governedCase = legacySavedDealToInvestmentCase(governedRecord);
check('P1-REGISTRY-WIRED-INTO-CANONICAL-CASE',
  governedCase.assumptions.status === 'PASS'
    && governedCase.governance.status === 'PASS'
    && governedCase.legacyMetadata.assumptionRegistryPresent === true
    && governedCase.legacyMetadata.assumptionRegistryHashSha256 === governedCase.governance.assumptionRegistryHashSha256,
  'canonical case receives evaluated assumptions and governance hash');

check('P1-FINANCIAL-RESULT-UNCHANGED-BY-GOVERNANCE-METADATA',
  Object.is(legacyCase.financialModel.irr, governedCase.financialModel.irr)
    && Object.is(legacyCase.financialModel.npv, governedCase.financialModel.npv)
    && legacyCase.recommendation.verdict === governedCase.recommendation.verdict,
  'assumption governance does not rewrite deterministic engine economics');

const unsupportedCriticalRecord = withAssumptionRegistry(legacyRecord, [{
  id: 'exit-cap-rate',
  value: 0.085,
  critical: true,
  confidence: 'MEDIUM',
  owner: 'investment-team',
}]);
check('P1-UNSUPPORTED-CRITICAL-PERSISTS-FOR-REMEDIATION', (() => {
  try { validateSavedDealRecord(unsupportedCriticalRecord); return true; } catch (_) { return false; }
})(), 'unsupported evidence is not destroyed or rejected as malformed history');

const unsupportedCase = legacySavedDealToInvestmentCase(unsupportedCriticalRecord);
check('P1-UNSUPPORTED-CRITICAL-FAIL-CLOSED',
  unsupportedCase.governance.status === 'HOLD'
    && unsupportedCase.governance.failClosed === true
    && unsupportedCase.decision.status === 'HOLD'
    && unsupportedCase.decision.reasonCodes.some((code) => code.startsWith('CRITICAL_ASSUMPTION_UNSUPPORTED:exit-cap-rate')),
  `decision=${unsupportedCase.decision.status}`);

const staleCriticalRecord = withAssumptionRegistry(legacyRecord, [{
  id: 'market-rent',
  value: 1500,
  unit: 'SAR/sqm/year',
  critical: true,
  sourceType: 'MARKET_COMPARABLES',
  sourceReference: 'old-market-study',
  sourceDate: '2020-01-01T00:00:00.000Z',
  evidenceCount: 3,
  confidence: 'HIGH',
  owner: 'investment-team',
  expiresAt: '2021-01-01T00:00:00.000Z',
}]);
const staleCase = legacySavedDealToInvestmentCase(staleCriticalRecord);
check('P1-STALE-CRITICAL-FAIL-CLOSED',
  staleCase.governance.status === 'HOLD'
    && staleCase.decision.status === 'HOLD'
    && staleCase.decision.reasonCodes.some((code) => code.startsWith('CRITICAL_ASSUMPTION_STALE:market-rent')),
  `decision=${staleCase.decision.status}`);

const malformedCases = [
  { label: 'not-array', patch: { assumptionRegistry: {} } },
  { label: 'duplicate-id', patch: { assumptionRegistry: [{ id: 'x', value: 1 }, { id: 'x', value: 2 }] } },
  { label: 'version-without-registry', patch: { assumptionRegistryVersion: SAVED_DEAL_ASSUMPTION_REGISTRY_VERSION } },
  { label: 'wrong-version', patch: { assumptionRegistry: [], assumptionRegistryVersion: 'UNKNOWN' } },
];
for (const item of malformedCases) {
  let rejected = false;
  try { validateSavedDealRecord({ ...legacyRecord, ...item.patch }); }
  catch (error) { rejected = error instanceof SavedDealValidationError; }
  check(`P1-MALFORMED-${item.label.toUpperCase()}`, rejected, 'malformed governance metadata rejected structurally');
}

let nestedRejected = false;
try {
  validateSavedDealRecord({
    ...legacyRecord,
    inputs: { ...B, assumptionRegistry: supportedRegistry },
  });
} catch (error) {
  nestedRejected = error instanceof SavedDealValidationError
    && error.reasonCode === 'ASSUMPTION_REGISTRY_IN_ECONOMIC_INPUTS';
}
check('P1-REGISTRY-CANNOT-CONTAMINATE-ECONOMIC-INPUTS', nestedRejected, 'governance metadata remains outside economic inputs');

const allPass = results.every(Boolean);
console.log(`\nFINANCIAL_INTEGRITY_P1_ASSUMPTION_GOVERNANCE=${allPass ? 'PASS' : 'FAIL'}`);
process.exit(allPass ? 0 : 1);
