'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  VALUATION_METHOD,
  EVIDENCE_GRADE,
  INPUT_STATUS,
} = require('../../src/valuation-intelligence');
const {
  CriticalEvidenceDraftError,
  criticalEvidenceRowsFromValuationCase,
  applyCriticalEvidenceRowsToValuationCase,
} = require('../../src/app/critical-evidence-draft');

const root = path.join(__dirname, '..', '..');
const wrapper = fs.readFileSync(path.join(root, 'src/components/ValuationIntelligencePanel.jsx'), 'utf8');
const panel = fs.readFileSync(path.join(root, 'src/components/CriticalEvidenceRequirementsPanel.jsx'), 'utf8');
const draft = fs.readFileSync(path.join(root, 'src/app/critical-evidence-draft.js'), 'utf8');
const orchestrator = fs.readFileSync(path.join(root, 'src/valuation-intelligence/orchestrator.js'), 'utf8');

assert(wrapper.includes("import CriticalEvidenceRequirementsPanel from './CriticalEvidenceRequirementsPanel.jsx';"));
assert(wrapper.includes('<CriticalEvidenceRequirementsPanel'));
assert(panel.includes('criticalEvidenceRowsFromValuationCase(valuationCase)'));
assert(panel.includes('applyCriticalEvidenceRowsToValuationCase(valuationCase, rows)'));
assert(panel.includes("'effectiveGrossIncome'"));
assert(panel.includes("'operatingExpenses'"));
assert(panel.includes("'capitalizationRate'"));
assert(panel.includes("'landValue'"));
assert(panel.includes("'replacementCost'"));
assert(panel.includes("'depreciationRate'"));
assert(panel.includes('`comparable:${item.comparableId.trim()}`'));
assert(!panel.includes('fetch('));
assert(!panel.includes('window.'));
assert(draft.includes('AT_LEAST_ONE_REQUIRED'));
assert(draft.includes('DUPLICATE_REQUIREMENT'));
assert(draft.includes('INVALID_REQUIREMENT_ITEM'));
assert(orchestrator.includes('criticalRequirements: request.criticalEvidenceRequirements?.[planned.method] || []'));

const base = {
  schemaVersion: 1,
  projectId: 'PROJECT-001',
  classification: {},
  incomePolicy: {},
  marketComparableInput: {
    comparables: [{ comparableId: 'COMP-001' }, { comparableId: 'COMP-002' }],
  },
};

const rows = [
  {
    method: VALUATION_METHOD.INCOME_DIRECT_CAPITALIZATION,
    field: 'effectiveGrossIncome',
    allowedGrades: [EVIDENCE_GRADE.C_CONTRACTUAL, EVIDENCE_GRADE.D_OPERATING_ACTUAL],
    allowedStatuses: [INPUT_STATUS.VERIFIED, INPUT_STATUS.OBSERVED],
  },
  {
    method: VALUATION_METHOD.MARKET_COMPARABLE,
    field: 'comparable:COMP-001',
    allowedGrades: [EVIDENCE_GRADE.B_VERIFIED_TRANSACTION],
    allowedStatuses: [INPUT_STATUS.OBSERVED],
  },
];

const applied = applyCriticalEvidenceRowsToValuationCase(base, rows);
assert.strictEqual(applied.criticalEvidenceRequirements[VALUATION_METHOD.INCOME_DIRECT_CAPITALIZATION].length, 1);
assert.strictEqual(applied.criticalEvidenceRequirements[VALUATION_METHOD.MARKET_COMPARABLE][0].field, 'comparable:COMP-001');
assert.deepStrictEqual(criticalEvidenceRowsFromValuationCase(applied), rows);
assert.strictEqual(base.criticalEvidenceRequirements, undefined);

const cleared = applyCriticalEvidenceRowsToValuationCase(applied, []);
assert.strictEqual(cleared.criticalEvidenceRequirements, undefined);

assert.throws(
  () => applyCriticalEvidenceRowsToValuationCase(base, [{ ...rows[0], allowedGrades: [] }]),
  (error) => error instanceof CriticalEvidenceDraftError && error.reasonCode === 'AT_LEAST_ONE_REQUIRED',
);
assert.throws(
  () => applyCriticalEvidenceRowsToValuationCase(base, [rows[0], rows[0]]),
  (error) => error instanceof CriticalEvidenceDraftError && error.reasonCode === 'DUPLICATE_REQUIREMENT',
);

const malformedRows = criticalEvidenceRowsFromValuationCase({
  ...base,
  criticalEvidenceRequirements: {
    [VALUATION_METHOD.INCOME_DIRECT_CAPITALIZATION]: [null],
  },
});
assert.strictEqual(malformedRows.length, 1);
assert.strictEqual(malformedRows[0].hydrationError, 'INVALID_REQUIREMENT_ITEM');
assert.throws(
  () => applyCriticalEvidenceRowsToValuationCase(base, malformedRows),
  (error) => error instanceof CriticalEvidenceDraftError && error.reasonCode === 'INVALID_REQUIREMENT_ITEM',
);

console.log('CRITICAL_EVIDENCE_REQUIREMENTS_UI_V1=PASS');
console.log('CRITICAL_EVIDENCE_EXACT_FIELD_MATCHING=PASS');
console.log('CRITICAL_EVIDENCE_MALFORMED_INPUT_FAILS_CLOSED=PASS');
console.log('CRITICAL_EVIDENCE_NO_HIDDEN_DEFAULTS=PASS');
console.log('CRITICAL_EVIDENCE_NO_NETWORK_PATH=PASS');
