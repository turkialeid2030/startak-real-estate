'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
let checks = 0;
function check(fn) { fn(); checks += 1; }
function read(relativePath) { return fs.readFileSync(path.join(ROOT, relativePath), 'utf8'); }

const headers = read('public/_headers');
const policy = read('CSP_POLICY.md');
const cspLine = headers.split(/\r?\n/).map((line) => line.trim()).find((line) => line.startsWith('Content-Security-Policy:'));
assert(cspLine, 'public/_headers must contain a Content-Security-Policy header');
check(() => assert(policy.includes(cspLine), 'CSP_POLICY.md must document the exact shipped CSP line'));
check(() => assert(policy.includes('DOCUMENTED_ARTIFACT_POLICY_MATCHES_PUBLIC_HEADERS = TRUE')));
check(() => assert(policy.includes('LIVE_EDGE_HEADER_ENFORCEMENT_VERIFIED = FALSE')));

const csp = cspLine.slice('Content-Security-Policy:'.length).trim();
const directives = new Map(csp.split(';').map((part) => part.trim()).filter(Boolean).map((part) => {
  const [name, ...values] = part.split(/\s+/);
  return [name, values];
}));
const scriptSrc = directives.get('script-src') || [];
const connectSrc = directives.get('connect-src') || [];
const frameSrc = directives.get('frame-src') || [];
check(() => assert.deepStrictEqual(scriptSrc, ["'self'", 'https://challenges.cloudflare.com']));
check(() => assert(!scriptSrc.includes("'unsafe-inline'")));
check(() => assert(!scriptSrc.includes("'unsafe-eval'")));
check(() => assert.deepStrictEqual(frameSrc, ['https://challenges.cloudflare.com']));
check(() => assert(connectSrc.includes('https://challenges.cloudflare.com')));
check(() => assert(connectSrc.includes('https://o4512003775004672.ingest.de.sentry.io')));
check(() => assert.deepStrictEqual(directives.get('object-src'), ["'none'"]));
check(() => assert.deepStrictEqual(directives.get('frame-ancestors'), ["'none'"]));
check(() => assert.deepStrictEqual(directives.get('form-action'), ["'self'"]));

const readinessGate = read('src/security/production-security-readiness-gate.js');
const orchestrator = read('src/security/security-readiness-orchestrator.js');
const reviewEvidence = read('src/security/production-security-review-evidence.js');
for (const source of [readinessGate, orchestrator]) {
  check(() => assert(source.includes('productionSecurityVerifiedByThisModule: false')));
  check(() => assert(source.includes('independentSecurityReviewRequired: true')));
  check(() => assert(source.includes('transactionAuthorized: false')));
}
check(() => assert(reviewEvidence.includes('productionSecurityCertified: false')));
check(() => assert(reviewEvidence.includes('humanApprovalRequired: true')));
check(() => assert(reviewEvidence.includes('transactionAuthorized: false')));
check(() => assert(reviewEvidence.includes('HOLD_BLOCKING_FINDINGS')));
check(() => assert(reviewEvidence.includes("['CRITICAL', 'HIGH']")));

const evidence = JSON.parse(read('release/evidence/c46-internal-security-review.json'));
check(() => assert.strictEqual(evidence.scope, 'C46_INTERNAL_SECURITY_REVIEW_AND_HARDENING'));
check(() => assert.strictEqual(evidence.baseC45QualifiedHeadSha, '4318c411a8dd41629f0f26c0d715615f5cdaef08'));
check(() => assert.strictEqual(evidence.internalEngineeringDecision, 'READY_FOR_INDEPENDENT_SECURITY_REVIEW'));
check(() => assert.strictEqual(evidence.externalSecurityAuthorizationGranted, false));
check(() => assert.strictEqual(evidence.gate545Satisfied, false));
check(() => assert.strictEqual(evidence.productionSecurityCertified, false));
check(() => assert.strictEqual(evidence.deploymentAuthorized, false));
check(() => assert.strictEqual(evidence.commercialGoLiveAuthorized, false));
check(() => assert.strictEqual(evidence.penetrationTestingPerformedByC46, false));
check(() => assert.strictEqual(evidence.liveEdgeHeaderEnforcementVerified, false));

const immutableUse = /^\s*-?\s*uses:\s*[^\s@]+@[a-f0-9]{40}\s*$/i;
for (const workflowPath of [
  '.github/workflows/wave17a-security-qualification-evidence-verify.yml',
  '.github/workflows/c46-internal-security-review.yml',
]) {
  const workflow = read(workflowPath);
  const usesLines = workflow.split(/\r?\n/).filter((line) => /^\s*-?\s*uses:/.test(line));
  check(() => assert(usesLines.length > 0, `${workflowPath} must use at least one external action`));
  usesLines.forEach((line) => check(() => assert(immutableUse.test(line), `${workflowPath} has mutable action reference: ${line.trim()}`)));
  check(() => assert(/permissions:\s*\n\s*contents:\s*read/m.test(workflow), `${workflowPath} must set contents: read`));
}

const highConfidenceSecretPatterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /AKIA[0-9A-Z]{16}/,
  /ghp_[A-Za-z0-9]{30,}/,
  /github_pat_[A-Za-z0-9_]{30,}/,
];
const securityDir = path.join(ROOT, 'src', 'security');
const securityFiles = fs.readdirSync(securityDir).filter((name) => name.endsWith('.js'));
for (const name of securityFiles) {
  const source = fs.readFileSync(path.join(securityDir, name), 'utf8');
  for (const pattern of highConfidenceSecretPatterns) {
    check(() => assert(!pattern.test(source), `high-confidence secret pattern found in src/security/${name}`));
  }
}

console.log(`C46_INTERNAL_SECURITY_REVIEW=PASS checks=${checks}`);
console.log('C46_READY_FOR_INDEPENDENT_SECURITY_REVIEW=PASS');
console.log('C46_EXTERNAL_SECURITY_AUTHORIZED=FALSE');
console.log('C46_GATE_545_SATISFIED=FALSE');
console.log('C46_DEPLOYMENT_AUTHORIZED=FALSE');
console.log('C46_COMMERCIAL_GO_LIVE_AUTHORIZED=FALSE');
