'use strict';

const assert = require('assert');
const {
  STANDARD_STATUS,
  MANDATORY_OR_GUIDANCE,
  LEGAL_REVIEW_STATUS,
  sha256,
} = require('../../src/standards/standards-registry');
const { routeStandards } = require('../../src/standards/purpose-based-standards-router');
const {
  CONFLICT_INDEPENDENCE_STATUS,
  COMPETENCE_STATUS,
  RIGHT_TYPE,
  RIGHT_SOURCE_CLASS,
} = require('../../src/valuation/professional-assignment');
const {
  buildSavedDealStandardsMetadata,
  validateSavedDealStandardsMetadata,
  assertSavedDealStandardsMetadata,
  withStandardsSnapshot,
  reconstructHistoricalStandardsEnvironment,
} = require('../../src/standards/saved-deal-standards-snapshot');
const { validateSavedDealRecord } = require('../../src/validation/saved-deal-schema');
const {
  buildExportPayload,
  planRestore,
  OPTIONAL_DEAL_EXTENSION_KEYS,
} = require('../../src/storage/saved-deals-backup');

function standard(overrides = {}) {
  return {
    standard_id: 'SYNTHETIC_SNAPSHOT_STANDARD',
    title_ar: 'معيار اصطناعي لاختبار اللقطة التاريخية',
    title_en: 'Synthetic Historical Snapshot Standard',
    issuer: 'SYNTHETIC_TEST_ISSUER',
    jurisdiction: 'SAUDI_ARABIA',
    category: 'VALUATION',
    version: '2026.1',
    publication_date: '2025-12-01',
    effective_date: '2026-01-01',
    expiry_date: null,
    status: STANDARD_STATUS.ACTIVE,
    source_url: 'https://example.invalid/snapshot-standard',
    official_source: false,
    last_verified: '2026-09-01',
    next_review: '2026-12-31',
    supersedes: [],
    superseded_by: [],
    applicable_asset_classes: ['OFFICE'],
    applicable_purposes: ['ACQUISITION_ANALYSIS'],
    applicable_intended_uses: ['INTERNAL_INVESTMENT_DECISION_SUPPORT'],
    applicable_intended_users: ['INVESTMENT_COMMITTEE'],
    applicable_transaction_contexts: ['ACQUISITION'],
    mandatory_or_guidance: MANDATORY_OR_GUIDANCE.MANDATORY,
    rule_version_hash: sha256('synthetic-snapshot-standard-2026.1'),
    reviewer: 'SYNTHETIC_STANDARDS_REVIEWER',
    legal_review_status: LEGAL_REVIEW_STATUS.PENDING,
    ...overrides,
  };
}

function assignment(overrides = {}) {
  return {
    client: 'SYNTHETIC CLIENT',
    intended_user: 'INVESTMENT_COMMITTEE',
    intended_use: 'INTERNAL_INVESTMENT_DECISION_SUPPORT',
    purpose: 'ACQUISITION_ANALYSIS',
    asset: { type: 'OFFICE', jurisdiction: 'SAUDI_ARABIA', location: 'SYNTHETIC_RIYADH' },
    rights: [{
      type: RIGHT_TYPE.OWNERSHIP,
      source_class: RIGHT_SOURCE_CLASS.VERIFIED,
      description: 'Synthetic verified ownership interest',
      source_reference: 'SYNTHETIC-DOC-1',
    }],
    basis: 'SYNTHETIC_MARKET_VALUE_BASIS',
    valuation_date: '2026-09-07',
    report_date: '2026-09-07',
    scope: 'Synthetic scope for persistence testing only',
    assumptions: [],
    special_assumptions: [],
    information_reliance: ['SYNTHETIC-DOC-1'],
    limitations: [],
    conflicts: { status: CONFLICT_INDEPENDENCE_STATUS.CLEAR, notes: null },
    independence: { status: CONFLICT_INDEPENDENCE_STATUS.CLEAR, notes: null },
    competence: {
      status: COMPETENCE_STATUS.CLEAR,
      location: 'RIYADH',
      complexity: 'STANDARD',
      specialization_required: false,
      specialist_reviewer: null,
    },
    reviewer: 'SYNTHETIC_ASSIGNMENT_REVIEWER',
    transaction_context: 'ACQUISITION',
    ...overrides,
  };
}

function standardsRoute(assignmentValue = assignment(), registry = [standard()]) {
  return routeStandards(registry, {
    jurisdiction: assignmentValue.asset.jurisdiction,
    valuation_purpose: assignmentValue.purpose,
    intended_use: assignmentValue.intended_use,
    intended_user: assignmentValue.intended_user,
    asset_type: assignmentValue.asset.type,
    reporting_framework: assignmentValue.reporting_framework || null,
    regulated_entity_status: assignmentValue.regulated_entity_status || null,
    transaction_context: assignmentValue.transaction_context || null,
    financing_context: assignmentValue.financing_context || null,
    as_of_date: assignmentValue.valuation_date,
  });
}

function baseDeal() {
  return {
    id: 'deal_snapshot_1',
    name: 'Synthetic snapshot deal',
    mode: 'building',
    inputs: { buildingPrice: 1000000 },
    savedAt: '2026-09-07T09:00:00.000Z',
    assumptionModelVersion: 'V2',
  };
}

function expectThrow(fn, code) {
  let thrown = null;
  try { fn(); } catch (error) { thrown = error; }
  assert(thrown, `Expected ${code}`);
  assert.strictEqual(thrown.code || thrown.reasonCode, code, `Expected ${code}, got ${thrown.code || thrown.reasonCode}`);
}

async function main() {
  let checks = 0;
  const check = (condition, message) => { assert(condition, message); checks++; };

  const a = assignment();
  const route = standardsRoute(a);
  const metadata = buildSavedDealStandardsMetadata({
    standards_route: route,
    professional_assignment: a,
    model_version: 'MODEL_SYNTHETIC_1',
    report_date: '2026-09-07',
  });

  check(/^[a-f0-9]{64}$/.test(metadata.standardsSnapshotVersion), 'Saved Deal standards snapshot must have deterministic hash version');
  check(metadata.standardsSnapshot.selected.length === 1 && metadata.standardsSnapshot.selected[0].version === '2026.1', 'Snapshot must preserve exact active standard version');
  check(metadata.valuationStandardsContext.valuationDate === a.valuation_date, 'Valuation context must preserve assignment valuation date');
  check(metadata.valuationStandardsContext.modelVersion === 'MODEL_SYNTHETIC_1', 'Valuation context must preserve exact model version');
  check(metadata.valuationStandardsContext.automaticRecalculationOnNewStandard === false, 'Saved deal must forbid automatic recalculation under a later standard');
  check(metadata.valuationStandardsContext.transactionAuthorized === false, 'Snapshot metadata must not authorize a transaction');

  const inputs = baseDeal().inputs;
  const enriched = withStandardsSnapshot(baseDeal(), metadata);
  check(enriched.inputs === inputs || JSON.stringify(enriched.inputs) === JSON.stringify(inputs), 'Attaching standards metadata must not alter economic inputs');
  check(!Object.prototype.hasOwnProperty.call(enriched.inputs, 'standardsSnapshotVersion'), 'Standards snapshot version must remain top-level metadata');

  const validation = validateSavedDealStandardsMetadata(enriched);
  check(validation.valid === true && validation.present === true, `Complete standards metadata must validate: ${validation.errors.join(',')}`);
  check(assertSavedDealStandardsMetadata(enriched) === true, 'Complete standards metadata assertion must pass');
  check(validateSavedDealRecord(enriched) === enriched, 'Canonical Saved Deal validator must accept complete standards metadata without mutation');

  const partial = { ...baseDeal(), standardsSnapshotVersion: metadata.standardsSnapshotVersion };
  const partialValidation = validateSavedDealStandardsMetadata(partial);
  check(partialValidation.valid === false && partialValidation.errors.includes('STANDARDS_METADATA_GROUP_INCOMPLETE'), 'Partial standards metadata group must fail closed');
  let partialThrown = null;
  try { validateSavedDealRecord(partial); } catch (error) { partialThrown = error; }
  check(partialThrown?.reasonCode === 'INVALID_STANDARDS_SNAPSHOT_METADATA', 'Canonical Saved Deal validator must reject partial standards metadata group');

  const tampered = {
    ...enriched,
    standardsSnapshotVersion: sha256('tampered-version'),
  };
  check(validateSavedDealStandardsMetadata(tampered).errors.includes('STANDARDS_SNAPSHOT_VERSION_MISMATCH'), 'Tampered snapshot version must be detected');
  expectThrow(() => assertSavedDealStandardsMetadata(tampered), 'INVALID_SAVED_DEAL_STANDARDS_METADATA');
  checks++;

  const draftSnapshot = {
    ...enriched,
    standardsSnapshot: {
      ...enriched.standardsSnapshot,
      selected: enriched.standardsSnapshot.selected.map((item) => ({ ...item, status: STANDARD_STATUS.DRAFT })),
    },
  };
  check(validateSavedDealStandardsMetadata(draftSnapshot).errors.includes('STANDARDS_SNAPSHOT_NON_ACTIVE_VERSION'), 'Historical production snapshot must never contain DRAFT selected version');

  const nestedMetadataDeal = {
    ...baseDeal(),
    inputs: { ...baseDeal().inputs, standardsSnapshotVersion: metadata.standardsSnapshotVersion },
  };
  let nestedThrown = null;
  try { validateSavedDealRecord(nestedMetadataDeal); } catch (error) { nestedThrown = error; }
  check(nestedThrown?.reasonCode === 'STANDARDS_METADATA_IN_ECONOMIC_INPUTS', 'Canonical validator must reject standards metadata nested in economic inputs');
  expectThrow(() => withStandardsSnapshot(nestedMetadataDeal, metadata), 'STANDARDS_METADATA_MUST_NOT_BE_ECONOMIC_INPUT');
  checks++;

  const history = reconstructHistoricalStandardsEnvironment(enriched);
  check(history.selectedStandards.length === 1 && history.selectedStandards[0].version === '2026.1', 'Historical reconstruction must use saved version, not current registry');
  check(history.currentRegistryConsulted === false, 'Historical reconstruction must not consult current registry implicitly');
  check(history.automaticRecalculationOnNewStandard === false, 'Historical reconstruction must preserve no-auto-recalculation policy');
  check(history.modelVersion === 'MODEL_SYNTHETIC_1', 'Historical reconstruction must preserve model version');

  const futureCurrentRegistry = [standard({ version: '2027.1', rule_version_hash: sha256('new-current-registry') })];
  check(history.selectedStandards[0].version !== futureCurrentRegistry[0].version, 'A newer current registry version must not rewrite historical snapshot identity');

  const mismatchedAssignment = assignment({ valuation_date: '2026-09-06', report_date: '2026-09-07' });
  expectThrow(() => buildSavedDealStandardsMetadata({
    standards_route: route,
    professional_assignment: mismatchedAssignment,
    model_version: 'MODEL_SYNTHETIC_1',
    report_date: '2026-09-07',
  }), 'ASSIGNMENT_ROUTE_VALUATION_DATE_MISMATCH');
  checks++;

  check(OPTIONAL_DEAL_EXTENSION_KEYS.includes('standardsSnapshotVersion') && OPTIONAL_DEAL_EXTENSION_KEYS.includes('valuationStandardsContext'), 'Backup projection must explicitly preserve standards metadata extensions');
  check(OPTIONAL_DEAL_EXTENSION_KEYS.includes('assumptionModelVersion') && OPTIONAL_DEAL_EXTENSION_KEYS.includes('zakatCase'), 'Backup projection must preserve existing assumption/Zakat envelope metadata too');

  const storageMap = new Map([['deal:' + enriched.id, JSON.stringify(enriched)]]);
  const storageProvider = {
    async get(key) { return storageMap.get(key) || null; },
    async set(key, value) { storageMap.set(key, value); },
  };
  const exported = await buildExportPayload([{ id: enriched.id }], storageProvider);
  check(exported.backupVersion === 4, 'Additive per-deal provenance must preserve v4 backup envelope compatibility');
  check(exported.deals[0].standardsSnapshotVersion === metadata.standardsSnapshotVersion, 'Backup export must preserve standardsSnapshotVersion');
  check(exported.deals[0].valuationStandardsContext.routeHash === metadata.valuationStandardsContext.routeHash, 'Backup export must preserve standards route provenance');
  check(exported.deals[0].assumptionModelVersion === 'V2', 'Backup export must preserve assumptionModelVersion metadata');

  const restorePlan = planRestore(exported, [], new Map());
  check(restorePlan.toWrite.length === 1, 'Valid historical snapshot deal must be restorable');
  const restored = restorePlan.toWrite[0].record;
  check(restored.standardsSnapshotVersion === metadata.standardsSnapshotVersion, 'Restore plan must preserve exact standardsSnapshotVersion');
  check(restored.standardsSnapshot.selected[0].version === '2026.1', 'Restore plan must preserve exact historical selected standard version');
  check(reconstructHistoricalStandardsEnvironment(restored).currentRegistryConsulted === false, 'Restored deal must remain independently historically reconstructible');

  console.log(`WAVE_7D_STANDARDS_PROVENANCE=PASS checks=${checks}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
