'use strict';

const fs = require('fs');
const path = require('path');
const { SAUDI_OFFICIAL_SOURCE_CATALOG } = require('../src/sources/saudi-official-source-catalog');

const REVIEW_PATH = path.join(__dirname, '..', 'release', 'evidence', 'c45-internal-source-rights-advisory-review.json');

function loadReview() {
  return JSON.parse(fs.readFileSync(REVIEW_PATH, 'utf8'));
}

function validateReview(review) {
  if (!review || review.schemaVersion !== 1) throw new Error('C45_SCHEMA_INVALID');
  if (review.scope !== 'C45_INTERNAL_SOURCE_RIGHTS_ADVISORY_REVIEW') throw new Error('C45_SCOPE_INVALID');
  if (review.reviewAuthorityBoundary !== 'INTERNAL_ADVISORY_ONLY_NOT_INDEPENDENT_EXTERNAL_LEGAL_AUTHORITY') {
    throw new Error('C45_AUTHORITY_BOUNDARY_INVALID');
  }
  if (review.internalAdvisoryDecision !== 'APPROVED_WITH_RESTRICTIONS') throw new Error('C45_ADVISORY_DECISION_INVALID');
  if (review.externalSourceRightsAuthorizationGranted !== false) throw new Error('C45_EXTERNAL_AUTHORITY_MUST_REMAIN_FALSE');
  if (review.gate548Satisfied !== false) throw new Error('C45_GATE_548_MUST_REMAIN_FALSE');
  for (const key of ['mergeAuthorized', 'deploymentAuthorized', 'commercialGoLiveAuthorized', 'publicAiAuthorized']) {
    if (review[key] !== false) throw new Error(`C45_${key.toUpperCase()}_MUST_REMAIN_FALSE`);
  }
  if (!review.policy || review.policy.default !== 'DENY_UNLESS_EXPLICIT_OPEN_DATA_OR_WRITTEN_PERMISSION') {
    throw new Error('C45_DEFAULT_POLICY_NOT_FAIL_CLOSED');
  }
  if (!Array.isArray(review.sources)) throw new Error('C45_SOURCES_REQUIRED');

  const catalogIds = SAUDI_OFFICIAL_SOURCE_CATALOG.map((s) => s.id).sort();
  const reviewIds = review.sources.map((s) => s.sourceId).sort();
  if (JSON.stringify(catalogIds) !== JSON.stringify(reviewIds)) throw new Error('C45_SOURCE_UNIVERSE_MISMATCH');

  for (const source of review.sources) {
    if (!source.advisoryDisposition) throw new Error(`C45_DISPOSITION_MISSING:${source.sourceId}`);
    if (!Array.isArray(source.evidence) || source.evidence.length === 0) throw new Error(`C45_EVIDENCE_MISSING:${source.sourceId}`);
    if (source.externalAuthorization !== false) throw new Error(`C45_EXTERNAL_SOURCE_AUTHORITY_MUST_REMAIN_FALSE:${source.sourceId}`);
    if (!Array.isArray(source.approvedChannels) || source.approvedChannels.length === 0) throw new Error(`C45_APPROVED_CHANNELS_MISSING:${source.sourceId}`);
    if (!Array.isArray(source.prohibitedChannels) || source.prohibitedChannels.length === 0) throw new Error(`C45_PROHIBITED_CHANNELS_MISSING:${source.sourceId}`);
  }

  const ejar = review.sources.find((s) => s.sourceId === 'EJAR_RENTAL_ECOSYSTEM');
  if (!ejar || ejar.advisoryDisposition !== 'HOLD_EXPLICIT_PERMISSION_REQUIRED') {
    throw new Error('C45_EJAR_MUST_REMAIN_HOLD');
  }

  return {
    sourceCount: review.sources.length,
    conditionalCount: review.sources.filter((s) => s.advisoryDisposition.startsWith('CONDITIONAL_')).length,
    holdCount: review.sources.filter((s) => s.advisoryDisposition.startsWith('HOLD_')).length,
    internalAdvisoryDecision: review.internalAdvisoryDecision,
    gate548Satisfied: review.gate548Satisfied,
  };
}

function run() {
  const result = validateReview(loadReview());
  console.log('C45_INTERNAL_SOURCE_RIGHTS_ADVISORY_REVIEW=PASS');
  console.log(`C45_SOURCE_COUNT=${result.sourceCount}`);
  console.log(`C45_CONDITIONAL_SOURCE_COUNT=${result.conditionalCount}`);
  console.log(`C45_HOLD_SOURCE_COUNT=${result.holdCount}`);
  console.log(`C45_INTERNAL_ADVISORY_DECISION=${result.internalAdvisoryDecision}`);
  console.log(`C45_GATE_548_SATISFIED=${String(result.gate548Satisfied).toUpperCase()}`);
  console.log('C45_EXTERNAL_SOURCE_RIGHTS_AUTHORIZED=FALSE');
  console.log('C45_FINAL_POSTURE=INTERNAL_ADVISORY_APPROVED_EXTERNAL_LEGAL_GATE_HOLD');
  return result;
}

if (require.main === module) {
  try {
    run();
  } catch (error) {
    console.error(`C45_INTERNAL_SOURCE_RIGHTS_ADVISORY_REVIEW=FAIL ${error.message}`);
    process.exit(1);
  }
}

module.exports = { loadReview, validateReview, run };
