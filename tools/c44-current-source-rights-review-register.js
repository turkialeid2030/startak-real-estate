'use strict';

const fs = require('fs');
const path = require('path');
const {
  SAUDI_OFFICIAL_SOURCE_CATALOG,
} = require('../src/sources/saudi-official-source-catalog');

const ROOT = path.resolve(__dirname, '..');
const REGISTER_PATH = path.join(ROOT, 'release/evidence/c44-current-source-rights-review-register.json');
const C43_PATH = path.join(ROOT, 'release/evidence/c43-external-review-handoff-packets.json');
const EXPECTED_OVERLAY_BASE = '088792d841bddf9af28af6aea0d9ea93c2440f5d';
const EXPECTED_FROZEN_CANDIDATE = 'db05999e5a3c995235ac290c256251ab1592072b';
const EXPECTED_IDS = Object.freeze([
  'REGA_REAL_ESTATE_INDICATORS',
  'GASTAT_REAL_ESTATE_STATISTICS',
  'ZATCA_REAL_ESTATE_TAX',
  'SAMA_REAL_ESTATE_FINANCE',
  'MOJ_REAL_ESTATE_TRANSACTIONS',
  'EJAR_RENTAL_ECOSYSTEM',
]);
const AUTHORITY_KEYS = Object.freeze([
  'sourceRightsAuthorized',
  'releaseDecisionAuthorized',
  'mergeAuthorized',
  'deploymentAuthorized',
  'commercialGoLiveAuthorized',
  'transactionAuthority',
  'approvalAuthorized',
  'publicAiAuthorized',
]);

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function stableSource(source) {
  const result = {
    id: source.id,
    authority: source.authority,
    officialDomain: source.officialDomain,
  };
  if (source.officialProductDomain !== undefined) result.officialProductDomain = source.officialProductDomain;
  result.purpose = Array.from(source.purpose || []);
  result.retrievalMode = source.retrievalMode;
  result.integrationStatus = source.integrationStatus;
  return result;
}

function validate(register = readJson(REGISTER_PATH), c43 = readJson(C43_PATH)) {
  if (register.schemaVersion !== 1) fail('C44_SCHEMA_INVALID');
  if (register.scope !== 'C44_CURRENT_GOVERNED_OFFICIAL_SOURCE_RIGHTS_REVIEW_REGISTER') fail('C44_SCOPE_INVALID');
  if (register.overlayBaseHeadSha !== EXPECTED_OVERLAY_BASE) fail('C44_OVERLAY_BASE_INVALID');
  if (register.frozenReviewCandidateHeadSha !== EXPECTED_FROZEN_CANDIDATE) fail('C44_FROZEN_CANDIDATE_INVALID');
  if (register.sourceCatalogPath !== 'src/sources/saudi-official-source-catalog.js') fail('C44_SOURCE_CATALOG_PATH_INVALID');
  if (register.governingIssue !== 548 || register.governingGate !== 'C30:SOURCE_RIGHTS_AUTHORIZATION') fail('C44_GOVERNING_GATE_INVALID');
  if (register.gateState !== 'NOT_SUPPLIED') fail('C44_FALSE_GATE_STATE');
  if (register.registerRule !== 'PUBLIC_OR_OFFICIAL_VISIBILITY_DOES_NOT_ESTABLISH_REUSE_RIGHTS_AND_NO_SOURCE_IS_AUTHORIZED_WITHOUT_TRACEABLE_LEGAL_OR_DATA_GOVERNANCE_DISPOSITION') fail('C44_REGISTER_RULE_INVALID');
  if (register.scopeBoundary !== 'CURRENT_GOVERNED_OFFICIAL_SOURCE_CATALOG_ONLY_NOT_A_CLAIM_ABOUT_EVERY_THIRD_PARTY_SOFTWARE_OR_GENERIC_WEB_DEPENDENCY') fail('C44_SCOPE_BOUNDARY_INVALID');

  if (!Array.isArray(register.sources) || register.sources.length !== 6 || register.sourceCount !== 6) fail('C44_SOURCE_COUNT_INVALID');
  if (register.liveConnectorsConfigured !== 0) fail('C44_FALSE_LIVE_CONNECTOR_CLAIM');
  if (register.hardcodedOfficialSourceValues !== 0) fail('C44_FALSE_HARDCODED_VALUE_CLAIM');
  if (register.sourceUniversePrepared !== true) fail('C44_SOURCE_UNIVERSE_NOT_PREPARED');
  if (register.sourceRightsAuthorized !== false || register.gateSatisfied !== false) fail('C44_FALSE_SOURCE_RIGHTS_AUTHORIZATION');

  const catalogIds = SAUDI_OFFICIAL_SOURCE_CATALOG.map((item) => item.id);
  if (JSON.stringify(catalogIds) !== JSON.stringify(EXPECTED_IDS)) fail('C44_CATALOG_ID_SET_CHANGED');
  const registerIds = register.sources.map((item) => item.id);
  if (JSON.stringify(registerIds) !== JSON.stringify(EXPECTED_IDS)) fail('C44_REGISTER_ID_SET_INVALID');

  for (let i = 0; i < SAUDI_OFFICIAL_SOURCE_CATALOG.length; i += 1) {
    const catalog = stableSource(SAUDI_OFFICIAL_SOURCE_CATALOG[i]);
    const entry = register.sources[i];
    const compare = {
      id: entry.id,
      authority: entry.authority,
      officialDomain: entry.officialDomain,
    };
    if (entry.officialProductDomain !== undefined) compare.officialProductDomain = entry.officialProductDomain;
    compare.purpose = entry.purpose;
    compare.retrievalMode = entry.retrievalMode;
    compare.integrationStatus = entry.integrationStatus;
    if (JSON.stringify(compare) !== JSON.stringify(catalog)) fail(`C44_CATALOG_REGISTER_MISMATCH:${entry.id}`);
    if (entry.integrationStatus !== 'NOT_CONFIGURED') fail(`C44_LIVE_INTEGRATION_FALSELY_CLAIMED:${entry.id}`);
    if (entry.retrievalMode !== 'MANUAL_OR_GOVERNED_CONNECTOR_REQUIRED') fail(`C44_RETRIEVAL_MODE_INVALID:${entry.id}`);
    if (entry.rightsDisposition !== 'REVIEW_REQUIRED') fail(`C44_RIGHTS_DISPOSITION_INVALID:${entry.id}`);
    if (entry.rightsEvidenceSupplied !== false) fail(`C44_RIGHTS_EVIDENCE_FALSELY_SUPPLIED:${entry.id}`);
    if (entry.authorizationGranted !== false) fail(`C44_AUTHORIZATION_FALSELY_GRANTED:${entry.id}`);
    if (entry.publicVisibilityIsNotReuseAuthorization !== true) fail(`C44_PUBLIC_VISIBILITY_BOUNDARY_INVALID:${entry.id}`);
    if (entry.requiredReviewerRole !== 'qualified Saudi legal/data-governance reviewer') fail(`C44_REVIEWER_ROLE_INVALID:${entry.id}`);
  }

  const sourceRightsPacket = (c43.packets || []).find((item) => item.requestKey === 'C30:SOURCE_RIGHTS_AUTHORIZATION');
  if (!sourceRightsPacket) fail('C44_C43_SOURCE_RIGHTS_PACKET_MISSING');
  if (sourceRightsPacket.issue !== 548 || sourceRightsPacket.gateState !== 'NOT_SUPPLIED') fail('C44_C43_GATE_BINDING_INVALID');
  if (sourceRightsPacket.externalReceiptConfirmed !== false || sourceRightsPacket.evidenceSatisfied !== false) fail('C44_C43_FALSE_EVIDENCE_STATE');

  if (!register.reviewRequest || register.reviewRequest.state !== 'SOURCE_UNIVERSE_PREPARED_RIGHTS_REVIEW_PENDING') fail('C44_REVIEW_REQUEST_STATE_INVALID');
  if (register.reviewRequest.externalReceiptConfirmed !== false || register.reviewRequest.reviewCompleted !== false) fail('C44_FALSE_REVIEW_COMPLETION');
  if (typeof register.reviewRequest.requiredDisposition !== 'string' || !register.reviewRequest.requiredDisposition.trim()) fail('C44_REQUIRED_DISPOSITION_MISSING');

  if (!register.authority || typeof register.authority !== 'object') fail('C44_AUTHORITY_BLOCK_MISSING');
  for (const key of AUTHORITY_KEYS) {
    if (register.authority[key] !== false) fail(`C44_AUTHORITY_ESCALATION:${key}`);
  }

  return {
    schemaVersion: 1,
    scope: 'C44_CURRENT_SOURCE_RIGHTS_REVIEW_REGISTER_SUMMARY',
    frozenReviewCandidateHeadSha: register.frozenReviewCandidateHeadSha,
    sourceCount: register.sources.length,
    sourceUniversePrepared: true,
    liveConnectorsConfigured: 0,
    hardcodedOfficialSourceValues: 0,
    rightsReviewRequiredCount: register.sources.filter((item) => item.rightsDisposition === 'REVIEW_REQUIRED').length,
    rightsEvidenceSuppliedCount: register.sources.filter((item) => item.rightsEvidenceSupplied === true).length,
    authorizationGrantedCount: register.sources.filter((item) => item.authorizationGranted === true).length,
    externalReceiptConfirmed: false,
    gate548Satisfied: false,
    sourceRightsAuthorized: false,
    mergeAuthorized: false,
    deploymentAuthorized: false,
    commercialGoLiveAuthorized: false,
    publicAiAuthorized: false,
    decision: 'SOURCE_UNIVERSE_PREPARED_RIGHTS_REVIEW_PENDING',
  };
}

if (require.main === module) {
  process.stdout.write(`${JSON.stringify(validate(), null, 2)}\n`);
}

module.exports = { validate, EXPECTED_IDS, AUTHORITY_KEYS };
