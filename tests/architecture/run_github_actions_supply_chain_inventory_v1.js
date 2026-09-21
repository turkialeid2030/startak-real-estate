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
  '.github/workflows/post-release-production-verify.yml',
  '.github/workflows/production-ai-smoke.yml',
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
