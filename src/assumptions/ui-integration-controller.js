'use strict';

const { STUDY_TYPE } = require('../engines');
const { calculateGovernedInvestmentCase } = require('../decision-governance/investment-case-orchestrator');
const { TRANSACTION_AUTHORITY } = require('../decision-governance/overall-decision-gate');
const { AUDIT_ACTION, createAuditEvent } = require('../decision-governance/audit-trail');
const {
  ASSUMPTION_MODEL_VERSION,
  V2_APPROVED_ASSUMPTIONS,
  normalizeAssumptionModelVersion,
} = require('./assumption-model');
const {
  createFreshWorkspaceState,
  hydrateSavedDealForUi,
  buildNewSavedDealRecord,
  buildUpdatedSavedDealRecord,
  explicitlyUpgradeUiDeal,
} = require('./ui-deal-lifecycle');
const {
  formatOptionalPercentInput,
  parseOptionalPercentInput,
  applyOptionalPercentToInputs,
  buildUiAssumptionGovernance,
} = require('./ui-assumption-governance');

const UI_MODE = Object.freeze({ BUILDING: 'building', LAND: 'land' });
const DEFAULT_TRANSACTION_AUTHORITY = TRANSACTION_AUTHORITY.ANALYSIS_ONLY;

function authorityView(authority = DEFAULT_TRANSACTION_AUTHORITY) {
  if (!Object.values(TRANSACTION_AUTHORITY).includes(authority)) {
    throw new TypeError(`Unsupported transaction authority: ${authority}`);
  }
  return Object.freeze({
    transactionAuthority: authority,
    // Compatibility field for existing UI consumers. It can become true only
    // through an explicit, separately traceable EXECUTION_AUTHORIZED process.
    transactionAuthorized: authority === TRANSACTION_AUTHORITY.EXECUTION_AUTHORIZED,
  });
}

function assertMode(mode) {
  if (!Object.values(UI_MODE).includes(mode)) throw new TypeError(`Unsupported UI mode: ${mode}`);
  return mode;
}

function assertPlainObject(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${name} must be an object`);
}

function studyTypeForMode(mode) {
  assertMode(mode);
  return mode === UI_MODE.BUILDING ? STUDY_TYPE.EXISTING_BUILDING : STUDY_TYPE.LAND_DEVELOPMENT;
}

function materializeUiAssumptions(inputs, assumptionModelVersion) {
  assertPlainObject(inputs, 'inputs');
  const version = normalizeAssumptionModelVersion(assumptionModelVersion);
  if (version !== ASSUMPTION_MODEL_VERSION.V2) return { ...inputs };
  return { ...inputs, ...V2_APPROVED_ASSUMPTIONS };
}

function createUiWorkspace({ mode, defaultInputs }) {
  assertMode(mode);
  assertPlainObject(defaultInputs, 'defaultInputs');
  const workspace = createFreshWorkspaceState(defaultInputs);
  const inputs = materializeUiAssumptions(workspace.inputs, workspace.assumptionModelVersion);
  if (mode === UI_MODE.BUILDING) delete inputs.exitCapRate;
  return Object.freeze({ mode, ...workspace, inputs, ...authorityView() });
}

function hydrateUiDeal({ record, defaultInputs }) {
  assertPlainObject(record, 'record');
  assertPlainObject(defaultInputs, 'defaultInputs');
  const mode = assertMode(record.mode);
  const hydrated = hydrateSavedDealForUi(record, defaultInputs);
  const inputs = materializeUiAssumptions(hydrated.inputs, hydrated.assumptionModelVersion);
  // Saved financial data never grants execution authority by itself.
  return Object.freeze({ mode, ...hydrated, inputs, ...authorityView() });
}

function calculateUiInvestmentState({ mode, inputs, assumptionModelVersion }) {
  assertMode(mode);
  assertPlainObject(inputs, 'inputs');
  const version = normalizeAssumptionModelVersion(assumptionModelVersion);
  const governedCase = calculateGovernedInvestmentCase({
    studyType: studyTypeForMode(mode),
    inputs,
    leverageEnabled: Boolean(inputs.leverageEnabled),
    assumptionModelVersion: version,
  });
  const results = governedCase.financialResult;
  const governance = mode === UI_MODE.BUILDING
    ? buildUiAssumptionGovernance({ assumptionModelVersion: version, financialResults: results })
    : null;
  return Object.freeze({
    mode,
    assumptionModelVersion: version,
    results,
    governance,
    acquisitionCostGovernance: governedCase.acquisitionCostGovernance,
    sensitivityReady: governance ? governance.sensitivityReady : true,
    sensitivityRenderPolicy: governance ? governance.sensitivity.renderPolicy : 'RENDER_SENSITIVITY_OUTPUTS',
    exitCapInputRequired: governance ? governance.exitCapInputRequired : false,
    // Financial output, including a PASS verdict, cannot elevate authority.
    ...authorityView(),
  });
}

function applyExitCapInputText({ inputs, rawText, min = 0, max = 1 }) {
  assertPlainObject(inputs, 'inputs');
  const parsed = parseOptionalPercentInput(rawText, { min, max });
  const nextInputs = applyOptionalPercentToInputs(inputs, 'exitCapRate', parsed);
  return Object.freeze({ inputs: nextInputs, parsed, displayValue: formatOptionalPercentInput(nextInputs.exitCapRate), exitCapPresent: parsed.present, ...authorityView() });
}

function buildUiDisclosureViewModel({ governance, locale = 'ar-SA' }) {
  if (!governance || typeof governance !== 'object' || Array.isArray(governance)) throw new TypeError('governance must be an object');
  const language = locale === 'en' ? 'en' : 'ar';
  const disclosure = governance.disclosure;
  const exitCapNotice = disclosure.exitCapNotice ? disclosure.exitCapNotice[language] : null;
  return Object.freeze({
    badge: disclosure.badge[language],
    assumptionModelVersion: disclosure.assumptionModelVersion,
    legacyCompatibility: disclosure.legacyCompatibility,
    approvedAssumptionKeys: disclosure.approvedAssumptionKeys,
    exitCapSource: disclosure.exitCapSource,
    exitCapNotice,
    exitCapInputRequired: governance.exitCapInputRequired,
    sensitivityStatus: governance.sensitivity.status,
    sensitivityReady: governance.sensitivityReady,
    sensitivityRenderPolicy: governance.sensitivity.renderPolicy,
    ...authorityView(),
  });
}

function auditVersionId(record) {
  const id = record && record.id ? String(record.id) : 'unsaved-deal';
  const stamp = record && record.savedAt ? String(record.savedAt) : new Date().toISOString();
  return `${id}:${stamp}`;
}

function attachLocalAuditEvent(record, { actionType, modelVersion }) {
  assertPlainObject(record, 'record');
  const event = createAuditEvent({
    dealId: record.id || 'unsaved-deal',
    versionId: auditVersionId(record),
    timestamp: record.savedAt || new Date().toISOString(),
    actionType,
    changedFields: record.inputs && typeof record.inputs === 'object' ? Object.keys(record.inputs) : [],
    modelVersion,
    assumptionVersion: modelVersion,
  });
  return Object.freeze({ ...record, localAuditEvent: event });
}

function prepareNewUiDealForSave(record) {
  const prepared = buildNewSavedDealRecord(record);
  return attachLocalAuditEvent(prepared, {
    actionType: AUDIT_ACTION.DEAL_CREATED,
    modelVersion: prepared.assumptionModelVersion || ASSUMPTION_MODEL_VERSION.V2,
  });
}

function prepareUpdatedUiDealForSave(record, assumptionModelVersion) {
  const prepared = buildUpdatedSavedDealRecord(record, assumptionModelVersion);
  return attachLocalAuditEvent(prepared, {
    actionType: AUDIT_ACTION.VERSION_SAVED,
    modelVersion: prepared.assumptionModelVersion,
  });
}

function explicitlyUpgradeUiDealToV2(record) { return explicitlyUpgradeUiDeal(record); }

module.exports = {
  UI_MODE,
  DEFAULT_TRANSACTION_AUTHORITY,
  authorityView,
  studyTypeForMode,
  materializeUiAssumptions,
  createUiWorkspace,
  hydrateUiDeal,
  calculateUiInvestmentState,
  applyExitCapInputText,
  buildUiDisclosureViewModel,
  auditVersionId,
  attachLocalAuditEvent,
  prepareNewUiDealForSave,
  prepareUpdatedUiDealForSave,
  explicitlyUpgradeUiDealToV2,
};
