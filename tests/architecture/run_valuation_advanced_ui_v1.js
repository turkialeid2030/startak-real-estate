'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', '..');
const app = fs.readFileSync(path.join(root, 'src/app/App.jsx'), 'utf8');
const wrapper = fs.readFileSync(path.join(root, 'src/components/ValuationIntelligencePanel.jsx'), 'utf8');
const base = fs.readFileSync(path.join(root, 'src/components/ValuationIntelligenceBasePanel.jsx'), 'utf8');
const advanced = fs.readFileSync(path.join(root, 'src/components/ValuationAdvancedPanel.jsx'), 'utf8');
const draft = fs.readFileSync(path.join(root, 'src/app/valuation-advanced-draft.js'), 'utf8');

assert(app.includes('import ValuationIntelligencePanel from "../components/ValuationIntelligencePanel.jsx";'));
assert(app.includes('<ValuationIntelligencePanel'));
assert(wrapper.includes("import ValuationIntelligenceBasePanel from './ValuationIntelligenceBasePanel.jsx';"));
assert(wrapper.includes("import ValuationAdvancedPanel from './ValuationAdvancedPanel.jsx';"));
assert(wrapper.includes('valuationCase ? ('));
assert(wrapper.includes('<ValuationAdvancedPanel'));
assert(base.includes('buildValuationCaseFromDraft(draft)'));
assert(advanced.includes('advancedDraftFromValuationCase(valuationCase)'));
assert(advanced.includes('applyAdvancedDraftToValuationCase(valuationCase, draft)'));
assert(advanced.includes('EVIDENCE_KEYS.map'));
assert(advanced.includes('emptyComparableDraft()'));
assert(advanced.includes('RECONCILABLE_METHODS.map'));
assert(!advanced.includes('fetch('));
assert(!advanced.includes('window.'));
assert(draft.includes("marketComparable: {\n      enabled: false,\n      subjectArea: '',\n      basis: '',\n      weightingPolicy: ''"));
assert(draft.includes("cost: {\n      enabled: false,\n      depreciationRate: ''"));
assert(draft.includes("reconciliation: {\n      enabled: false,\n      dispersionThreshold: ''"));
assert(draft.includes('WEIGHTS_MUST_SUM_TO_ONE'));
assert(draft.includes('MIN_TWO_COMPARABLES_REQUIRED'));

console.log('VALUATION_ADVANCED_UI_V1=PASS');
console.log('ADVANCED_UI_NO_HIDDEN_ECONOMIC_DEFAULTS=PASS');
console.log('ADVANCED_UI_NO_NETWORK_PATH=PASS');
