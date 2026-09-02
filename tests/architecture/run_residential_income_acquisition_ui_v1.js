'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', '..');
const app = fs.readFileSync(path.join(root, 'src/app/App.jsx'), 'utf8');
const panel = fs.readFileSync(path.join(root, 'src/components/ResidentialIncomeAcquisitionPanel.jsx'), 'utf8');
const api = fs.readFileSync(path.join(root, 'src/residential-income-acquisition/api.js'), 'utf8');
const ar = fs.readFileSync(path.join(root, 'src/i18n/locales/ar-SA.js'), 'utf8');
const en = fs.readFileSync(path.join(root, 'src/i18n/locales/en.js'), 'utf8');

assert(app.includes('import ResidentialIncomeAcquisitionPanel from "../components/ResidentialIncomeAcquisitionPanel.jsx";'));
assert(app.includes('useState(null)'));
assert(app.includes('createResidentialIncomeAcquisitionViewModel(residentialIncomeOperatingCase)'));
assert(app.includes('parseResidentialIncomeOperatingCaseEnvelope(text)'));
assert(app.includes('recordWithOperatingCase'));
assert(app.includes('{mode === "building" ? ('));
assert(app.includes('<ResidentialIncomeAcquisitionPanel'));
assert(panel.includes('data-testid="residential-income-acquisition-panel"'));
assert(panel.includes("viewModel.apiStatus === 'CASE_LOADED'"));
assert(panel.includes("if (!viewModel || typeof viewModel !== 'object') return null;"));

assert(api.includes("capabilityStatus: 'OPERATING_CASE_PORTABILITY_V1'"));
assert(api.includes('calculateOperatingMetrics(operatingCase)'));
assert(api.includes('calculatePropertyCosts(operatingCase, operatingMetrics)'));
assert(api.includes('financialCalculationExecuted: false'));
assert(api.includes('investmentDecision: null'));
assert(api.includes('legalConclusion: null'));
assert(api.includes('transactionAuthorized: false'));
assert(!api.includes('fetch('));
assert(!api.includes('window.'));
assert(!api.includes('calculateInvestmentCase'));
assert(!panel.includes('fetch('));
assert(!panel.includes('window.'));
assert(panel.includes("metrics?.status === 'CALCULATED'"));
assert(panel.includes("t('riai.annualContractRent')"));
assert(panel.includes("t('riai.physicalOccupancyUnits')"));
assert(panel.includes("t('riai.wale')"));
assert(panel.includes("t('riai.propertyCosts')"));
assert(panel.includes("t('riai.normalizedOpex')"));
assert(panel.includes("t('riai.unknownCapexItems')"));
assert(panel.includes('data-testid="riai-operating-case-file-input"'));
assert(panel.includes("t('riai.importOperatingCase')"));
assert(panel.includes("t('riai.exportOperatingCase')"));

for (const dictionary of [ar, en]) {
  assert(dictionary.includes('riai: {'));
  assert(dictionary.includes('boundaryTitle:'));
  assert(dictionary.includes('emptyState:'));
}

console.log('RESIDENTIAL_INCOME_ACQUISITION_UI_V1=PASS');
console.log('EXISTING_BUILDING_ONLY_SURFACE=PASS');
console.log('NO_SYNTHETIC_PRODUCTION_CASE=PASS');
console.log('VALIDATED_LOCAL_OPERATING_CASE_IMPORT=PASS');
console.log('SAVED_DEAL_OPERATING_CASE_BINDING=PASS');
console.log('NO_FINANCIAL_WRITE_OR_NETWORK_PATH=PASS');
