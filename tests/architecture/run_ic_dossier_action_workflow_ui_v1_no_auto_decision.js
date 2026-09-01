'use strict';
const fs = require('fs');
const panel = fs.readFileSync('src/components/InvestmentCommitteeDossierPanel.jsx','utf8');
for (const prohibited of ['transactionAuthorized: true','automatedDecision: true','numericConfidence:']) {
  if (panel.includes(prohibited)) throw new Error(`PROHIBITED_IC_UI_BEHAVIOR:${prohibited}`);
}
console.log('IC_DOSSIER_ACTION_WORKFLOW_UI_V1_NO_AUTO_DECISION=PASS');
