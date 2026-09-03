'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', '..');
const panel = fs.readFileSync(path.join(root, 'src/components/ResidentialIncomeAcquisitionPanel.jsx'), 'utf8');
const aiPanel = fs.readFileSync(path.join(root, 'src/components/ResidentialIncomeAiAssistPanel.jsx'), 'utf8');
const client = fs.readFileSync(path.join(root, 'src/residential-income-acquisition/ai-assist-client.js'), 'utf8');

assert(panel.includes("import ResidentialIncomeAiAssistPanel from './ResidentialIncomeAiAssistPanel';"));
assert(panel.includes('<ResidentialIncomeAiAssistPanel viewModel={viewModel} dir={dir} />'));
assert(aiPanel.includes('data-testid="riai-ai-assist-panel"'));
assert(aiPanel.includes('data-testid="riai-ai-assist-run"'));
assert(aiPanel.includes('requestResidentialIncomeAiAssist(viewModel)'));
assert(aiPanel.includes("state.status === 'SUCCESS'"));
assert(aiPanel.includes('ACTIVATION_INCOMPLETE_CODES.has(state.reasonCode)'));
assert(aiPanel.includes("'AI_ACCESS_NOT_CONFIGURED'"));
assert(aiPanel.includes("'AI_ACCESS_REQUIRED'"));
assert(aiPanel.includes("'AI_PROVIDER_NOT_CONFIGURED'"));
assert(aiPanel.includes('deterministic analytical engine remains fully operational'));
assert(aiPanel.includes('لا توصية شراء/بيع'));
assert(aiPanel.includes('لا رأي قانوني'));
assert(aiPanel.includes('لا تعديل تلقائي للحسابات'));

// User action is required; no mount-time request is allowed.
const effectBlock = aiPanel.match(/React\.useEffect\([\s\S]*?\}, \[caseKey\]\);/);
assert(effectBlock);
assert(!effectBlock[0].includes('requestResidentialIncomeAiAssist'));
assert(aiPanel.includes('onClick={runReview}'));

// AI output remains ephemeral UI state and is not written to persistence APIs.
assert(!aiPanel.includes('localStorage'));
assert(!aiPanel.includes('sessionStorage'));
assert(!aiPanel.includes('saveDeal'));
assert(!aiPanel.includes('updateDeal'));
assert(!aiPanel.includes('recordWithOperatingCase'));

// Network egress remains encapsulated in the same-origin client, not the component.
assert(!aiPanel.includes("fetch("));
assert(client.includes("const AI_ASSIST_ENDPOINT = '/api/riai/ai-assist';"));
assert(client.includes("credentials: 'same-origin'"));
assert(client.includes("cache: 'no-store'"));

console.log('RIAI_AI_UI_V1=PASS');
console.log('MANUAL_OPT_IN_ONLY=PASS');
console.log('AI_OUTPUT_EPHEMERAL_NOT_PERSISTED=PASS');
console.log('SAME_ORIGIN_CLIENT_BOUNDARY=PASS');
