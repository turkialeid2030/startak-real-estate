'use strict';

const { calculateInvestmentCase, STUDY_TYPE } = require('../engines');
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

const UI_MODE = Object.freeze({
  BUILDING: 'building',
  LAND: 'land',
});

function assertMode(mode) {
  if (!Object.values(UI_MODE).includes(mode)) {
    throw new TypeError(`Unsupported UI mode: ${mode}`);
  }
  return mode;
}

function assertPlainObject(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${name} must be an object`);
  }
}

function studyTypeForMode(mode) {
  assertMode(mode);
  return mode === UI_MODE.BUILDING
    ? STUDY_TYPE.EXISTING_BUILDING
    : STUDY_TYPE.LAND_DEVELOPMENT;
}

function materializeUiAssumptions(inputs, assumptionModelVersion) {
  assertPlainObject(inputs, 'inputs');
  const version = normalizeAssumptionModelVersion(assumptionModelVersion);
  if (version !== ASSUMPTION_MODEL_VERSION.V2) return { ...inputs };
  return {
    ...inputs,
    ...V2_APPROVED_ASSUMPTIONS,
  };
}

function createUiWorkspace({ mode, defaultInputs }) {
  assertMode(mode);
  assertPlainObject(defaultInputs, 'defaultInputs');
  const workspace = createFreshWorkspaceState(defaultInputs);
  const inputs = materializeUiAssumptions(workspace.inputs, workspace.assumptionModelVersion);

  // V2 existing-building work must start with explicit exit assumptions.
  // Template/default datasets may contain compatibility/sample values, but they
  // are not user/deal evidence and must not be silently promoted into a fresh V2
  // deal. Land/development retains its existing input semantics.
  if (mode === UI_MODE.BUILDING) {
    delete inputs.exitCapRate;
    delete inputs.exitTransferFeeRate;
  }

  return Object.freeze({
    mode,
    ...workspace,
    inputs,
    transactionAuthorized: false,
  });
}

function hydrateUiDeal({ record, defaultInputs }) {
  assertPlainObject(record, 'record');
  assertPlainObject(defaultInputs, 'defaultInputs');
  const mode = assertMode(record.mode);
  const hydrated = hydrateSavedDealForUi(record, defaultInputs);
  const inputs = materializeUiAssumptions(hydrated.inputs, hydrated.assumptionModelVersion);
  return Object.freeze({
    mode,
    ...hydrated,
    inputs,
    transactionAuthorized: false,
  });
}

function calculateUiInvestmentState({ mode, inputs, assumptionModelVersion }) {
  assertMode(mode);
  assertPlainObject(inputs, 'inputs');
  const version = normalizeAssumptionModelVersion(assumptionModelVersion);
  const results = calculateInvestmentCase({
    studyType: studyTypeForMode(mode),
    inputs,
    leverageEnabled: Boolean(inputs.leverageEnabled),
    assumptionModelVersion: version,
  });
  const governance = mode === UI_MODE.BUILDING
    ? buildUiAssumptionGovernance({
        assumptionModelVersion: version,
        financialResults: results,
      })
    : null;

  return Object.freeze({
    mode,
    assumptionModelVersion: version,
    results,
    governance,
    sensitivityReady: governance ? governance.sensitivityReady : true,
    sensitivityRenderPolicy: governance
      ? governance.sensitivity.renderPolicy
      : 'RENDER_SENSITIVITY_OUTPUTS',
    exitCapInputRequired: governance ? governance.exitCapInputRequired : false,
    exitTransactionCostInputRequired: governance ? governance.exitTransactionCostInputRequired : false,
    transactionAuthorized: false,
  });
}

function buildInvalidOptionalPercentDraft(inputs, key, rawText, error) {
  const text = String(rawText ?? '').trim();
  const numericPercent = Number(text);
  const invalidValue = text !== '' && Number.isFinite(numericPercent)
    ? numericPercent / 100
    : NaN;
  const nextInputs = { ...inputs, [key]: invalidValue };
  return Object.freeze({
    inputs: nextInputs,
    parsed: Object.freeze({ present: true, value: invalidValue, valid: false }),
    displayValue: text,
    inputValid: false,
    errorCode: error && error.code ? error.code : 'OPTIONAL_PERCENT_INVALID',
    transactionAuthorized: false,
  });
}

function applyOptionalPercentInputText({ inputs, key, rawText, min = 0, max = 1 }) {
  assertPlainObject(inputs, 'inputs');
  let parsed;
  try {
    parsed = parseOptionalPercentInput(rawText, { min, max });
  } catch (error) {
    return buildInvalidOptionalPercentDraft(inputs, key, rawText, error);
  }
  const nextInputs = applyOptionalPercentToInputs(inputs, key, parsed);
  return Object.freeze({
    inputs: nextInputs,
    parsed,
    displayValue: formatOptionalPercentInput(nextInputs[key]),
    inputPresent: parsed.present,
    inputValid: true,
    errorCode: null,
    transactionAuthorized: false,
  });
}

function applyExitCapInputText({ inputs, rawText, min = 0, max = 1 }) {
  const result = applyOptionalPercentInputText({
    inputs,
    key: 'exitCapRate',
    rawText,
    min,
    max,
  });
  return Object.freeze({
    ...result,
    exitCapPresent: result.inputPresent,
  });
}

function applyExitTransactionCostInputText({ inputs, rawText, min = 0, max = 1 }) {
  const result = applyOptionalPercentInputText({
    inputs,
    key: 'exitTransferFeeRate',
    rawText,
    min,
    max,
  });
  return Object.freeze({
    ...result,
    exitTransactionCostPresent: result.inputPresent,
  });
}

function buildUiDisclosureViewModel({ governance, locale = 'ar-SA' }) {
  if (!governance || typeof governance !== 'object' || Array.isArray(governance)) {
    throw new TypeError('governance must be an object');
  }
  const language = locale === 'en' ? 'en' : 'ar';
  const disclosure = governance.disclosure;
  const exitCapNotice = disclosure.exitCapNotice
    ? disclosure.exitCapNotice[language]
    : null;
  const exitTransactionCostNotice = disclosure.exitTransactionCostNotice
    ? disclosure.exitTransactionCostNotice[language]
    : null;

  return Object.freeze({
    badge: disclosure.badge[language],
    assumptionModelVersion: disclosure.assumptionModelVersion,
    legacyCompatibility: disclosure.legacyCompatibility,
    approvedAssumptionKeys: disclosure.approvedAssumptionKeys,
    exitCapSource: disclosure.exitCapSource,
    exitCapNotice,
    exitCapInputRequired: governance.exitCapInputRequired,
    exitTransactionCostSource: disclosure.exitTransactionCostSource,
    exitTransactionCostNotice,
    exitTransactionCostInputRequired: governance.exitTransactionCostInputRequired,
    sensitivityStatus: governance.sensitivity.status,
    sensitivityReady: governance.sensitivityReady,
    sensitivityRenderPolicy: governance.sensitivity.renderPolicy,
    transactionAuthorized: false,
  });
}

function prepareNewUiDealForSave(record) {
  return buildNewSavedDealRecord(record);
}

function prepareUpdatedUiDealForSave(record, assumptionModelVersion) {
  return buildUpdatedSavedDealRecord(record, assumptionModelVersion);
}

function explicitlyUpgradeUiDealToV2(record) {
  return explicitlyUpgradeUiDeal(record);
}

module.exports = {
  UI_MODE,
  studyTypeForMode,
  materializeUiAssumptions,
  createUiWorkspace,
  hydrateUiDeal,
  calculateUiInvestmentState,
  applyExitCapInputText,
  applyExitTransactionCostInputText,
  buildUiDisclosureViewModel,
  prepareNewUiDealForSave,
  prepareUpdatedUiDealForSave,
  explicitlyUpgradeUiDealToV2,
};
