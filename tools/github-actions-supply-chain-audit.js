#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const WORKFLOW_DIR = path.join(ROOT, '.github', 'workflows');

function classifyUses(value) {
  if (value.startsWith('./')) return 'LOCAL';
  if (value.startsWith('docker://')) {
    return /@sha256:[a-f0-9]{64}$/i.test(value) ? 'IMMUTABLE_DIGEST' : 'MUTABLE_DOCKER_REFERENCE';
  }

  const at = value.lastIndexOf('@');
  if (at <= 0 || at === value.length - 1) return 'MALFORMED_OR_UNPINNED';
  const ref = value.slice(at + 1);
  return /^[a-f0-9]{40}$/i.test(ref) ? 'IMMUTABLE_SHA' : 'MUTABLE_REF';
}

function auditRepository(root = ROOT) {
  const workflowDir = path.join(root, '.github', 'workflows');
  const files = fs.readdirSync(workflowDir)
    .filter((name) => /\.ya?ml$/i.test(name))
    .sort();

  const references = [];
  for (const file of files) {
    const relativePath = path.posix.join('.github', 'workflows', file);
    const lines = fs.readFileSync(path.join(workflowDir, file), 'utf8').split(/\r?\n/);

    lines.forEach((line, index) => {
      const match = line.match(/^\s*uses:\s*([^\s#]+)\s*(?:#.*)?$/);
      if (!match) return;
      const value = match[1].trim();
      references.push({
        workflow: relativePath,
        line: index + 1,
        uses: value,
        classification: classifyUses(value),
      });
    });
  }

  const mutable = references.filter((x) => !['LOCAL', 'IMMUTABLE_SHA', 'IMMUTABLE_DIGEST'].includes(x.classification));
  const immutable = references.filter((x) => ['IMMUTABLE_SHA', 'IMMUTABLE_DIGEST'].includes(x.classification));
  const local = references.filter((x) => x.classification === 'LOCAL');

  return {
    schemaVersion: 1,
    workflowCount: files.length,
    actionReferenceCount: references.length,
    immutableReferenceCount: immutable.length,
    localReferenceCount: local.length,
    mutableReferenceCount: mutable.length,
    references,
    mutable,
  };
}

function renderText(report) {
  const lines = [
    `GITHUB_ACTIONS_WORKFLOW_COUNT=${report.workflowCount}`,
    `GITHUB_ACTION_REFERENCE_COUNT=${report.actionReferenceCount}`,
    `GITHUB_ACTION_IMMUTABLE_REFERENCE_COUNT=${report.immutableReferenceCount}`,
    `GITHUB_ACTION_LOCAL_REFERENCE_COUNT=${report.localReferenceCount}`,
    `GITHUB_ACTION_MUTABLE_REFERENCE_COUNT=${report.mutableReferenceCount}`,
  ];

  for (const item of report.mutable) {
    lines.push(`MUTABLE_ACTION=${item.workflow}:${item.line}|${item.uses}|${item.classification}`);
  }
  return `${lines.join('\n')}\n`;
}

function main() {
  const args = new Set(process.argv.slice(2));
  const report = auditRepository();

  if (args.has('--json')) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    process.stdout.write(renderText(report));
  }

  if (args.has('--fail-on-mutable') && report.mutableReferenceCount > 0) {
    process.exitCode = 2;
  }
}

if (require.main === module) main();

module.exports = {
  classifyUses,
  auditRepository,
  renderText,
};
