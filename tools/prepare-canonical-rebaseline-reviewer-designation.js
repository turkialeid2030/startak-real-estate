#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const {
  createCanonicalRebaselineReviewerDesignation,
} = require('../src/qualification/canonical-rebaseline-reviewer-designation');

function usage() {
  console.error('Usage: node tools/prepare-canonical-rebaseline-reviewer-designation.js --proposal <proposal.json> --owner-ref <owner-ref> --reviewer-ref <reviewer-ref> --reviewer-name <display-name> --designation-id <id> --source-ref <ref> --artifact-sha256 <sha256> --designated-at <iso> [--prior-designation <designation.json>] [--output <designation.json>]');
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (!key.startsWith('--')) throw new Error(`Unexpected argument: ${key}`);
    const value = argv[i + 1];
    if (value == null || value.startsWith('--')) throw new Error(`Missing value for ${key}`);
    out[key.slice(2)] = value;
    i += 1;
  }
  return out;
}

function readJson(filePath, label) {
  const resolved = path.resolve(filePath);
  const data = JSON.parse(fs.readFileSync(resolved, 'utf8'));
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error(`${label} must be a JSON object`);
  return data;
}

function rejectSecretBearingArgs(args) {
  const forbidden = ['private-key', 'password', 'token', 'secret', 'connection-string'];
  for (const key of forbidden) {
    if (Object.prototype.hasOwnProperty.call(args, key)) throw new Error(`Forbidden argument: --${key}`);
  }
}

function main() {
  try {
    const args = parseArgs(process.argv.slice(2));
    rejectSecretBearingArgs(args);
    const required = ['proposal', 'owner-ref', 'reviewer-ref', 'reviewer-name', 'designation-id', 'source-ref', 'artifact-sha256', 'designated-at'];
    for (const key of required) if (!args[key]) throw new Error(`Missing required --${key}`);

    const proposal = readJson(args.proposal, 'proposal');
    const prior = args['prior-designation'] ? readJson(args['prior-designation'], 'prior designation') : null;

    const designation = createCanonicalRebaselineReviewerDesignation({
      proposal,
      designationId: args['designation-id'],
      assignedByRef: args['owner-ref'],
      reviewerRef: args['reviewer-ref'],
      reviewerDisplayName: args['reviewer-name'],
      designationSourceRef: args['source-ref'],
      designationArtifactSha256: args['artifact-sha256'],
      designatedAt: args['designated-at'],
      replacesDesignationHashSha256: prior ? prior.designationHashSha256 : null,
    });

    if (designation.status !== 'REVIEWER_DESIGNATION_ACTIVE') {
      throw new Error(`Reviewer designation rejected: ${(designation.blockers || []).join(', ')}`);
    }

    const text = `${JSON.stringify(designation, null, 2)}\n`;
    if (args.output) fs.writeFileSync(path.resolve(args.output), text, 'utf8');
    else process.stdout.write(text);
  } catch (error) {
    usage();
    console.error(error.message);
    process.exit(1);
  }
}

main();
