'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const workspace = fs.readFileSync(path.join(root, 'src/components/LocalDocumentEvidenceWorkspace.jsx'), 'utf8');
const qualification = fs.readFileSync(path.join(root, 'src/components/LocalEvidenceQualificationPanel.jsx'), 'utf8');
const verification = fs.readFileSync(path.join(root, 'src/components/LocalEvidenceVerificationPanel.jsx'), 'utf8');

let checks = 0;
function check(name, fn) {
  fn();
  checks += 1;
  console.log(`PASS ${name}`);
}

check('verification panel is mounted through explicit in-app state rather than browser globals', () => {
  assert(workspace.includes("import LocalEvidenceVerificationPanel from './LocalEvidenceVerificationPanel.jsx';"));
  assert(workspace.includes('<LocalEvidenceVerificationPanel candidate={candidate}'));
  assert(workspace.includes('useState(null)'));
  assert(!workspace.includes('window.__STARTAK_'));
});

check('qualified candidate is explicitly propagated and invalidated when mapping inputs change', () => {
  assert(qualification.includes('onCandidateChange'));
  assert(qualification.includes('useEffect(() =>'));
  assert(qualification.includes('onCandidateChange?.(null)'));
  assert(qualification.includes('onCandidateChange?.(result)'));
});

check('verification UI uses the bounded verification gate and separate human decision API', () => {
  assert(verification.includes('buildEvidenceVerificationGate'));
  assert(verification.includes('recordEvidenceVerificationDecision'));
  assert(verification.includes('READY_FOR_HUMAN_VERIFICATION_DECISION'));
  assert(verification.includes('VERIFY_FACT'));
  assert(verification.includes('REJECT_CANDIDATE'));
  assert(verification.includes('DEFER'));
});

check('UNKNOWN authority cannot be selected for positive verification', () => {
  assert(verification.includes("filter((value) => value !== AUTHORITY_CLASS.UNKNOWN)"));
});

check('human verification requires original-source semantic conflict and accountability acknowledgements', () => {
  for (const token of [
    'sourceCheckedAgainstOriginal',
    'semanticMappingReviewed',
    'conflictDeclarationCompleted',
    'sourceReferenceReviewed',
    'authorityEvidenceReviewed',
    'verificationMethodReviewed',
    'humanAccountabilityAccepted',
  ]) assert(verification.includes(token), `missing ${token}`);
});

check('UI preserves verification boundary and does not call the financial engine or external network', () => {
  assert(verification.includes('لا يكتب أي مدخل مالي'));
  assert(verification.includes('does not write financial inputs'));
  assert(!verification.includes('calculateInvestmentCase'));
  assert(!verification.includes('fetch('));
  assert(!verification.includes('XMLHttpRequest'));
  assert(!verification.includes('WebSocket'));
});

check('workflow status never labels verified evidence as automatically underwriting-ready', () => {
  assert(workspace.includes('VERIFIED_FACT_RECORDED_NOT_UNDERWRITING_READY'));
  assert(!workspace.includes('AUTO_UNDERWRITING_READY'));
});

console.log(`EVIDENCE_VERIFICATION_UI_V1=PASS checks=${checks}`);
