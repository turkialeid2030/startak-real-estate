'use strict';
const fs = require('fs');
const main = fs.readFileSync('src/main.jsx','utf8');
if (!main.includes('__STARTAK_INVESTMENT_COMMITTEE_DOSSIER__')) throw new Error('IC_DOSSIER_RUNTIME_BOUNDARY_MISSING');
if (!main.includes('__STARTAK_DECISION_ACTION_REVIEW_REGISTER__')) throw new Error('ACTION_REVIEW_RUNTIME_BOUNDARY_MISSING');
if (main.includes('case-workspace-1') || main.includes('case-e2e-1') || main.includes('smoke-c1')) {
  throw new Error('SYNTHETIC_RUNTIME_CASE_EMBEDDED');
}
console.log('IC_DOSSIER_ACTION_WORKFLOW_UI_V1_RUNTIME_BOUNDARY=PASS');
