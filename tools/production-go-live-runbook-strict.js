#!/usr/bin/env node
'use strict';

const baseTool = require('./production-go-live-runbook');
const {
  STATUS,
  preparePinnedE2gDecisionSigningRequest,
  preparePinnedE2hAttestationSigningRequest,
  preparePinnedE2iEvidenceSigningRequest,
  evaluateProductionGoLiveRunbook,
} = require('../src/qualification/production-go-live-runbook-strict');

function readOptionalJson(filePath) {
  return filePath ? baseTool.readBoundedRegularJson(filePath) : null;
}

function execute(args) {
  if (args.mode === 'status') {
    return evaluateProductionGoLiveRunbook({
      e2fValidationPacket: readOptionalJson(args.e2f),
      expectedE2fValidationPacketHashSha256: args.e2fPin || null,
      e2gDecisionPacket: readOptionalJson(args.e2g),
      expectedE2gDecisionPacketHashSha256: args.e2gPin || null,
      e2hCloseoutPacket: readOptionalJson(args.e2h),
      expectedE2hCloseoutPacketHashSha256: args.e2hPin || null,
      e2iReadinessPacket: readOptionalJson(args.e2i),
      expectedE2iReadinessPacketHashSha256: args.e2iPin || null,
    });
  }

  const policy = baseTool.readBoundedRegularJson(args.policy);
  const upstream = baseTool.readBoundedRegularJson(args.upstream);
  const registry = baseTool.readBoundedRegularJson(args.registry);
  if (args.mode === 'e2g') {
    return preparePinnedE2gDecisionSigningRequest({
      expectedUpstreamValidationPacketHashSha256: args.upstreamPin,
      upstreamValidationPacket: upstream,
      policy,
      releaseAuthorityRegistry: registry,
      expectedReleaseAuthorityRegistryHashSha256: args.registryPin,
      decision: baseTool.readBoundedRegularJson(args.decision),
    });
  }
  if (args.mode === 'e2h') {
    return preparePinnedE2hAttestationSigningRequest({
      expectedUpstreamDecisionPacketHashSha256: args.upstreamPin,
      upstreamDecisionPacket: upstream,
      policy,
      executionAttestorRegistry: registry,
      expectedExecutionAttestorRegistryHashSha256: args.registryPin,
      attestation: baseTool.readBoundedRegularJson(args.attestation),
    });
  }
  return preparePinnedE2iEvidenceSigningRequest({
    expectedUpstreamCloseoutPacketHashSha256: args.upstreamPin,
    upstreamCloseoutPacket: upstream,
    policy,
    readinessVerifierRegistry: registry,
    expectedReadinessVerifierRegistryHashSha256: args.registryPin,
    evidence: baseTool.readBoundedRegularJson(args.evidence),
  });
}

function main() {
  let args;
  try {
    args = baseTool.parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    console.error(baseTool.usage());
    process.exit(64);
  }
  if (args.help) {
    console.log(baseTool.usage().replace('production-go-live-runbook.js', 'production-go-live-runbook-strict.js'));
    return;
  }
  try {
    const result = execute(args);
    if (args.out) baseTool.writePrivateJson(args.out, result);
    else process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if ([
      STATUS.HOLD_PRODUCTION_CHAIN_PROVENANCE_PIN,
      STATUS.HOLD_PRODUCTION_CHAIN_INTEGRITY,
      STATUS.HOLD_PRODUCTION_CHAIN_STAGE_GAP,
      STATUS.HOLD_RELEASE_CANDIDATE_DRIFT,
    ].includes(result.status)) process.exit(2);
  } catch (error) {
    console.error(`STRICT_PRODUCTION_GO_LIVE_RUNBOOK_ERROR: ${error.message}`);
    process.exit(65);
  }
}

if (require.main === module) main();

module.exports = {
  execute,
  main,
};
