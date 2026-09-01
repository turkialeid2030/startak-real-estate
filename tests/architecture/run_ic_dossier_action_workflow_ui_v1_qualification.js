'use strict';
const fs = require('fs');
const main = fs.readFileSync('src/main.jsx','utf8');
const panel = fs.readFileSync('src/components/InvestmentCommitteeDossierPanel.jsx','utf8');
if (!main.includes('__STARTAK_INVESTMENT_COMMITTEE_DOSSIER__')) throw new Error('IC_DOSSIER_RUNTIME_BOUNDARY_MISSING');
if (!main.includes('__STARTAK_DECISION_ACTION_REVIEW_REGISTER__')) throw new Error('ACTION_REVIEW_RUNTIME_BOUNDARY_MISSING');
if (!main.includes('InvestmentCommitteeDossierPanel')) throw new Error('IC_DOSSIER_PANEL_NOT_WIRED');
for (const token of ['ملف قرار لجنة الاستثمار','جاهزية اللجنة البشرية','الإجراءات وشروط الإغلاق','ANALYST','CHALLENGER','SYNTHESIZER']) {
  if (!panel.includes(token)) throw new Error(`IC_DOSSIER_UI_TOKEN_MISSING:${token}`);
}
if (main.includes('case-workspace-1') || main.includes('case-e2e-1') || main.includes('smoke-c1')) throw new Error('SYNTHETIC_RUNTIME_CASE_EMBEDDED');
console.log('IC_DOSSIER_ACTION_WORKFLOW_UI_V1_QUALIFICATION=PASS');
