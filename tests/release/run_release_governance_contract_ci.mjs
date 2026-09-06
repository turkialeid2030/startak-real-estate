import fs from 'fs';

const POLICY_PATH = 'governance/release-governance-policy.json';
const WORKFLOW_PATH = '.github/workflows/release-governance-verify.yml';
const policy = JSON.parse(fs.readFileSync(POLICY_PATH, 'utf8'));
const workflow = fs.readFileSync(WORKFLOW_PATH, 'utf8');

const checks = [];
let failed = false;

function record(name, passed, detail = null) {
  checks.push({ name, status: passed ? 'PASS' : 'FAIL', detail });
  if (!passed) failed = true;
  console.log(`${name}=${passed ? 'PASS' : 'FAIL'}${detail ? ` -- ${detail}` : ''}`);
}

record('RELEASE_GOVERNANCE_SCHEMA_V1', policy.schemaVersion === 1);
record('RELEASE_GOVERNANCE_NO_TRANSACTION_AUTHORITY', policy.transactionAuthorized === false);
record('RELEASE_GOVERNANCE_NO_AUTOMATIC_ROLLBACK', policy.rollbackReadiness?.automaticRollback === false);
record('RELEASE_GOVERNANCE_HUMAN_ROLLBACK_AUTHORITY', policy.rollbackReadiness?.rollbackAuthority === 'HUMAN_EXPLICIT_AUTHORIZATION_REQUIRED');
record('RELEASE_GOVERNANCE_EXACT_SHA_REQUIRED', policy.evidence?.requireExpectedDeployedShaOnPostReleaseChain === true);
record('RELEASE_GOVERNANCE_HEALTH_SAMPLE_FLOOR', Number.isInteger(policy.releaseHealth?.samples) && policy.releaseHealth.samples >= 3);
record('RELEASE_GOVERNANCE_SUCCESS_RATE_FAIL_CLOSED', policy.releaseHealth?.requiredSuccessRate === 1);
record('RELEASE_GOVERNANCE_NO_5XX_POLICY', policy.releaseHealth?.allowHttp5xx === false);
record('RELEASE_GOVERNANCE_ROLLBACK_HISTORY_DEPTH', Number.isInteger(policy.rollbackReadiness?.historyDepth) && policy.rollbackReadiness.historyDepth >= 2 && policy.rollbackReadiness.historyDepth <= 100);
record('RELEASE_GOVERNANCE_EVIDENCE_RETENTION', Number.isInteger(policy.evidence?.retentionDays) && policy.evidence.retentionDays >= 30 && policy.evidence.retentionDays <= 90);
record('RELEASE_GOVERNANCE_CHAINED_AFTER_POST_RELEASE', /workflows:\s*\['Post-Release Production Verify'\]/.test(workflow));
record('RELEASE_GOVERNANCE_WORKFLOW_RUN_FAIL_CLOSED', /github\.event\.workflow_run\.conclusion == 'success'/.test(workflow));
record('RELEASE_GOVERNANCE_READ_ONLY_CLOUDFLARE_QUERY', !/curl[^\n]*(?:-X|--request)\s*(?:POST|PUT|PATCH|DELETE)/i.test(workflow));
record('RELEASE_GOVERNANCE_NO_DEPLOY_COMMAND', !/wrangler\s+pages\s+deploy|cloudflare\s+pages\s+deploy|deployments\/[^\s]+\/rollback/i.test(workflow));
record('RELEASE_GOVERNANCE_EXPECTED_SHA_ENV', /EXPECTED_DEPLOYED_SHA:/.test(workflow));

const report = {
  schemaVersion: 1,
  suite: 'STARTAK_RELEASE_GOVERNANCE_CONTRACT_V1',
  checks,
  result: failed ? 'FAIL' : 'PASS',
  transactionAuthorized: false,
};

console.log(JSON.stringify(report, null, 2));
process.exit(failed ? 1 : 0);
