'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const main = fs.readFileSync(path.join(root, 'src/main.jsx'), 'utf8');
const panel = fs.readFileSync(path.join(root, 'src/components/CanonicalCaseWorkspacePanel.jsx'), 'utf8');
const governanceProjection = fs.readFileSync(path.join(root, 'src/runtime/canonical-governance-projections.js'), 'utf8');

assert(main.includes("import CanonicalCaseWorkspacePanel from './components/CanonicalCaseWorkspacePanel.jsx';"));
assert(main.includes('<CanonicalCaseWorkspacePanel />'));
assert(main.includes('Decision Intelligence may render only from that'));
assert(main.includes('Investment Committee, action-review, outcome-feedback'));

assert(panel.includes('createCanonicalWorkspaceFromSavedDeal'));
assert(panel.includes('createProjectProfile'));
assert(panel.includes("classificationSource: 'EXPLICIT_IN_APP_USER_SELECTION'"));
assert(panel.includes('classificationInferredFromDealName: false'));
assert(panel.includes("actorRole: 'SELF_ASSERTED_ANALYST'"));
assert(panel.includes("source: 'IN_APP_SAVED_DEAL_WORKSPACE'"));
assert(panel.includes('DecisionIntelligenceWorkspacePanel'));
assert(panel.includes('InvestmentCommitteeDossierPanel'));
assert(panel.includes('buildCanonicalCommitteePreparation'));
assert(!panel.includes('function buildDecisionWorkspace'));
assert(!panel.includes('window.__'));
assert(!panel.includes('window.decision'));
assert(!panel.includes('window.investment'));
assert(!panel.includes('localStorage.'));
assert(panel.includes('createStorageProvider()'));
assert(panel.includes("storage.get('deals-index')"));
assert(panel.includes('storage.get(`deal:${selectedDealId}`)'));

assert(governanceProjection.includes('WORKSPACE_STATUS.HOLD_STUDY'));
assert(governanceProjection.includes('WORKSPACE_STATUS.HOLD_AI_OUTPUTS'));
assert(governanceProjection.includes("'REQUIRED_AI_ROLE_OUTPUTS_MISSING'"));
assert(governanceProjection.includes("reliability: 'UNQUALIFIED_FOR_PROFESSIONAL_RELEASE'"));
assert(governanceProjection.includes('CANONICAL_COMMITTEE_PROJECTION_MUST_HOLD_WORKSPACE'));
assert(governanceProjection.includes('committeeDecisionRecorded: false'));
assert(governanceProjection.includes('transactionAuthorized: false'));
assert(!governanceProjection.includes('READY_FOR_COMMITTEE_PREPARATION: true'));

console.log('CANONICAL_WORKSPACE_UI_PATH=PASS');
