'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

let checks = 0;
function check(fn) { fn(); checks += 1; }
function read(relativePath) { return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8'); }
function exists(relativePath) { return fs.existsSync(path.join(process.cwd(), relativePath)); }

const requiredFiles = [
  'src/reporting/professional-report-contract.js',
  'src/reporting/professional-review.js',
  'src/reporting/report-conformance-qa.js',
  'src/reporting/index.js',
  'tests/architecture/run_wave15a_professional_report_contract.js',
  'tests/architecture/run_wave15b_professional_review.js',
  'tests/architecture/run_wave15c_report_conformance_qa.js',
  '.github/workflows/professional-report-contract-verify.yml',
  '.github/workflows/professional-review-verify.yml',
  '.github/workflows/report-conformance-qa-verify.yml',
  'docs/WAVE_15A_PROFESSIONAL_REPORT_CONTRACT.md',
  'docs/WAVE_15B_PROFESSIONAL_REVIEW.md',
  'docs/WAVE_15C_REPORT_CONFORMANCE_QA.md',
];
for (const file of requiredFiles) check(() => assert.strictEqual(exists(file), true, `missing ${file}`));

const report = read('src/reporting/professional-report-contract.js');
const review = read('src/reporting/professional-review.js');
const conformance = read('src/reporting/report-conformance-qa.js');
const index = read('src/reporting/index.js');

check(() => assert.match(report, /READY_FOR_INTERNAL_QA/));
check(() => assert.match(report, /REPORT_BLOCKED/));
check(() => assert.match(report, /UNLICENSED_DECISION_SUPPORT/));
check(() => assert.match(report, /externalIssuanceAuthorized:\s*false/));
check(() => assert.match(report, /certifiedValuationAuthorized:\s*false/));
check(() => assert.match(report, /transactionAuthorized:\s*false/));
check(() => assert.match(report, /taqeemConformanceClaimEstablished:\s*false/));
check(() => assert.match(report, /ivsConformanceClaimEstablished:\s*false/));
check(() => assert.match(report, /ricsConformanceClaimEstablished:\s*false/));

check(() => assert.match(review, /INDEPENDENT_REVIEW/));
check(() => assert.match(review, /APPROVE_NEXT_CONTROLLED_GATE/));
check(() => assert.match(review, /OPEN_REVIEW_FINDINGS_BLOCK_APPROVAL/));
check(() => assert.match(review, /INDEPENDENT_REVIEWER_CANNOT_BE_PREPARER/));
check(() => assert.match(review, /aiReviewApprovalPermitted:\s*false/));
check(() => assert.match(review, /externalIssuanceAuthorized:\s*false/));
check(() => assert.match(review, /certifiedValuationAuthorized:\s*false/));
check(() => assert.match(review, /transactionAuthorized:\s*false/));

check(() => assert.match(conformance, /READY_FOR_OFFICIAL_STANDARDS_REVIEW/));
check(() => assert.match(conformance, /CONFORMANCE_QA_BLOCKED/));
check(() => assert.match(conformance, /NO_ACTIVE_REPORTING_RULES_TO_ASSESS/));
check(() => assert.match(conformance, /REPORTING_RULE_SECTION_COVERAGE_MISSING/));
check(() => assert.match(conformance, /formalConformanceEstablished:\s*false/));
check(() => assert.match(conformance, /taqeemConformanceClaimEstablished:\s*false/));
check(() => assert.match(conformance, /ivsConformanceClaimEstablished:\s*false/));
check(() => assert.match(conformance, /ricsConformanceClaimEstablished:\s*false/));
check(() => assert.match(conformance, /professionalCredentialValidated:\s*false/));
check(() => assert.match(conformance, /externalIssuanceAuthorized:\s*false/));
check(() => assert.match(conformance, /certifiedValuationAuthorized:\s*false/));
check(() => assert.match(conformance, /transactionAuthorized:\s*false/));
check(() => assert.match(conformance, /UNLICENSED_DECISION_SUPPORT/));

check(() => assert.match(index, /professional-report-contract/));
check(() => assert.match(index, /professional-review/));
check(() => assert.match(index, /report-conformance-qa/));

const w15a = read('tests/architecture/run_wave15a_professional_report_contract.js');
const w15b = read('tests/architecture/run_wave15b_professional_review.js');
const w15c = read('tests/architecture/run_wave15c_report_conformance_qa.js');
check(() => assert.match(w15a, /WAVE_15A_PROFESSIONAL_REPORT_CONTRACT=PASS/));
check(() => assert.match(w15b, /WAVE_15B_PROFESSIONAL_REVIEW=PASS/));
check(() => assert.match(w15c, /WAVE_15C_REPORT_CONFORMANCE_QA=PASS/));

const workflowA = read('.github/workflows/professional-report-contract-verify.yml');
const workflowB = read('.github/workflows/professional-review-verify.yml');
const workflowC = read('.github/workflows/report-conformance-qa-verify.yml');
check(() => assert.match(workflowA, /npm run release:verify/));
check(() => assert.match(workflowB, /npm run release:verify/));
check(() => assert.match(workflowC, /npm run release:verify/));

const docs = [
  read('docs/WAVE_15A_PROFESSIONAL_REPORT_CONTRACT.md'),
  read('docs/WAVE_15B_PROFESSIONAL_REVIEW.md'),
  read('docs/WAVE_15C_REPORT_CONFORMANCE_QA.md'),
].join('\n');
check(() => assert.match(docs, /external issuance|external report issuance|externalIssuanceAuthorized/i));
check(() => assert.match(docs, /UNLICENSED_DECISION_SUPPORT/));
check(() => assert.match(docs, /formalConformanceEstablished|formal Taqeem/i));

console.log(`WAVE_15_REPORTING_REVIEW_CLOSEOUT=PASS checks=${checks}`);
