'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const workspace = fs.readFileSync(path.join(root, 'src/components/RentRollCollectionsWorkspace.jsx'), 'utf8');
const panel = fs.readFileSync(path.join(root, 'src/components/ResidentialIncomeAcquisitionPanel.jsx'), 'utf8');
const app = fs.readFileSync(path.join(root, 'src/app/App.jsx'), 'utf8');
const api = fs.readFileSync(path.join(root, 'src/residential-income-acquisition/api.js'), 'utf8');
const collections = fs.readFileSync(path.join(root, 'src/residential-income-acquisition/collections-reconciliation.js'), 'utf8');
const ar = fs.readFileSync(path.join(root, 'src/i18n/locales/ar-SA.js'), 'utf8');
const en = fs.readFileSync(path.join(root, 'src/i18n/locales/en.js'), 'utf8');

assert(workspace.includes('data-testid="riai-rent-roll-collections-workspace"'));
assert(workspace.includes('data-testid="riai-lease-editor"'));
assert(workspace.includes('data-testid="riai-collection-editor"'));
assert(workspace.includes('EXPLICIT_VERIFICATION_CONFIRMATION_REQUIRED') === false);
assert(workspace.includes('updateVerifiedLeaseTerms'));
assert(workspace.includes('addVerifiedRentCollection'));
assert(panel.includes("import RentRollCollectionsWorkspace from './RentRollCollectionsWorkspace';"));
assert(panel.includes('onReplaceOperatingCase={onReplaceOperatingCase}'));
assert(app.includes('replaceResidentialIncomeOperatingCase'));
assert(app.includes('hydrateResidentialIncomeOperatingCaseSnapshot(JSON.parse(JSON.stringify(candidate)))'));
assert(app.includes('onReplaceOperatingCase={replaceResidentialIncomeOperatingCase}'));
assert(api.includes('operatingCase,'));
assert(collections.includes('Collection rate equals verified cash collected'));
assert(collections.includes('Neither metric is silently written into stabilized NOI'));
assert(ar.includes('مساحة سجل الإيجارات والتحصيل'));
assert(en.includes('Rent Roll and Collections Workspace'));

console.log('RIAI rent roll and collections UI v1: PASS');
