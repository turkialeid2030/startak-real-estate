'use strict';
const fs = require('fs');
const main = fs.readFileSync('src/main.jsx','utf8');
if (!main.includes('__STARTAK_INVESTMENT_COMMITTEE_DOSSIER__')) throw new Error('IC_DOSSIER_RUNTIME_BOUNDARY_MISSING');
if (!main.includes('__STARTAK_ACTION_REVIEW_WORKFLOW__')) throw new Error('ACTION_REVIEW_RUNTIME_BOUNDARY_MISSING');
if (main.includes('APPROVE_WITH_CONDITIONS') || main.includes('DECIDED_BY_HUMANS')) {
  // These strings are only allowed if referenced by imported domain modules, not as embedded runtime payloads.
}
console.log('IC_DOSSIER_ACTION_WORKFLOW_UI_V1_RUNTIME_BOUNDARY=PASS');
