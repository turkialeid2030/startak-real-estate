#!/usr/bin/env node
'use strict';

const assert = require('assert');
const { auditRepository, renderText } = require('../../tools/github-actions-supply-chain-audit');

const report = auditRepository();
const critical = new Set([
  '.github/workflows/release-verify.yml',
  '.github/workflows/comprehensive-verify.yml',
  '.github/workflows/deep-platform-verify.yml',
  '.github/workflows/trusted-main-production-governance.yml',
  '.github/workflows/compliance-guard-verify.yml',
  '.github/workflows/compliance-production-verify.yml',
  '.github/workflows/commercial-closeout-verify.yml',
  '.github/workflows/commercial-method-readiness-verify.yml',
  '.github/workflows/commercial-operating-metrics-verify.yml',
  '.github/workflows/commercial-operating-stress-verify.yml',
  '.github/workflows/commercial-specialization-verify.yml',
  '.github/workflows/professional-assignment-verify.yml',
  '.github/workflows/professional-dcf-verify.yml',
  '.github/workflows/professional-evidence-chain-verify.yml',
  '.github/workflows/professional-income-noi-verify.yml',
  '.github/workflows/professional-report-contract-verify.yml',
  '.github/workflows/professional-review-verify.yml',
  '.github/workflows/specialized-asset-foundation-verify.yml',
  '.github/workflows/specialized-closeout-verify.yml',
  '.github/workflows/specialized-forecast-assumptions-verify.yml',
  '.github/workflows/specialized-interest-separation-verify.yml',
  '.github/workflows/specialized-operating-forecast-verify.yml',
  '.github/workflows/standards-foundation-verify.yml',
  '.github/workflows/standards-provenance-verify.yml',
  '.github/workflows/purpose-standards-router-verify.yml',
  '.github/workflows/regulated-context-routers-verify.yml',
  '.github/workflows/wave14-standards-convergence-verify.yml',
]);

assert.ok(report.workflowCount > 0, 'workflow inventory must not be empty');
assert.ok(report.actionReferenceCount > 0, 'action reference inventory must not be empty');

const criticalMutable = report.mutable.filter((item) => critical.has(item.workflow));
assert.deepStrictEqual(
  criticalMutable,
  [],
  `critical workflow mutable references are forbidden: ${JSON.stringify(criticalMutable)}`,
);

process.stdout.write(renderText(report));
console.log('GITHUB_ACTIONS_SUPPLY_CHAIN_INVENTORY=PASS_WITH_REPORTED_NONCRITICAL_REMAINDER');
