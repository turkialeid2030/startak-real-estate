#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const {
  STATUS,
  evaluateMainMergeProductionGovernance,
} = require('../src/qualification/main-merge-production-governance-gate');

const MAX_DECODED_BYTES = 2 * 1024 * 1024;

function decodeJsonBase64(value, field) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${field} is required`);
  let buffer;
  try {
    buffer = Buffer.from(value.trim(), 'base64');
  } catch (error) {
    throw new Error(`${field} must be valid base64`);
  }
  if (!buffer.length) throw new Error(`${field} decoded value is empty`);
  if (buffer.length > MAX_DECODED_BYTES) throw new Error(`${field} exceeds ${MAX_DECODED_BYTES} decoded bytes`);
  let parsed;
  try {
    parsed = JSON.parse(buffer.toString('utf8'));
  } catch (error) {
    throw new Error(`${field} must decode to valid JSON`);
  }
  return parsed;
}

function loadPolicy() {
  const policyPath = path.join(__dirname, '..', 'governance', 'e2g-human-release-authority-deployment-decision-policy-2026-09-08.json');
  return JSON.parse(fs.readFileSync(policyPath, 'utf8'));
}

function evaluateFromEnvironment(env = process.env) {
  const input = {
    e2fValidationPacket: decodeJsonBase64(env.STARTAK_E2F_PACKET_B64, 'STARTAK_E2F_PACKET_B64'),
    expectedE2fValidationPacketHashSha256: env.STARTAK_E2F_PACKET_PIN_SHA256,
    expectedE2fVerifierRegistryHashSha256: env.STARTAK_E2F_VERIFIER_REGISTRY_PIN_SHA256,
    e2gDecisionPacket: decodeJsonBase64(env.STARTAK_E2G_PACKET_B64, 'STARTAK_E2G_PACKET_B64'),
    expectedE2gDecisionPacketHashSha256: env.STARTAK_E2G_PACKET_PIN_SHA256,
    releaseAuthorityRegistry: decodeJsonBase64(env.STARTAK_E2G_RELEASE_AUTHORITY_REGISTRY_B64, 'STARTAK_E2G_RELEASE_AUTHORITY_REGISTRY_B64'),
    expectedReleaseAuthorityRegistryHashSha256: env.STARTAK_E2G_RELEASE_AUTHORITY_REGISTRY_PIN_SHA256,
    e2gPolicy: loadPolicy(),
    expectedReleaseSourceCommitSha: env.STARTAK_EXPECTED_RELEASE_SOURCE_COMMIT_SHA,
  };
  return evaluateMainMergeProductionGovernance(input);
}

function main() {
  let result;
  try {
    result = evaluateFromEnvironment(process.env);
  } catch (error) {
    console.error(`MAIN_MERGE_GOVERNANCE_INPUT_ERROR: ${error.message}`);
    process.exit(64);
  }

  console.log(`MAIN_MERGE_GOVERNANCE_STATUS=${result.status}`);
  console.log(`MAIN_MERGE_GOVERNANCE_VERIFIED=${result.verified === true ? 'true' : 'false'}`);
  if (result.observed?.sourceCommitSha) console.log(`MAIN_MERGE_RELEASE_SOURCE_COMMIT_SHA=${result.observed.sourceCommitSha}`);
  if (result.observed?.artifactSha256) console.log(`MAIN_MERGE_RELEASE_ARTIFACT_SHA256=${result.observed.artifactSha256}`);
  if (result.blockers?.length) {
    for (const blocker of result.blockers) console.error(`MAIN_MERGE_GOVERNANCE_BLOCKER=${blocker}`);
  }

  if (result.status !== STATUS.MAIN_MERGE_GOVERNANCE_VERIFIED_PENDING_GITHUB_MERGE || result.verified !== true) process.exit(2);
}

if (require.main === module) main();

module.exports = {
  MAX_DECODED_BYTES,
  decodeJsonBase64,
  loadPolicy,
  evaluateFromEnvironment,
  main,
};
