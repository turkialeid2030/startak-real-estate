'use strict';

const { calculateInvestmentCase, STUDY_TYPE } = require('../engines');
const { normalizeAssumptionModelVersion } = require('./assumption-model');
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

function createUiWorkspace({ mode, defaultInputs }) {
  assertMode(mode);
  assertPlainObject(defaultInputs, 'defaultInputs');
  const workspace = createFreshWorkspaceState(defaultInputs);
  const inputs = { ...workspace.inputs };

  // V2 existing-building work must start with an explicitly entered exit cap.
  // Template/default datasets may contain a compatibility/sample value, but that
  // value is not user evidence and must never be silently promoted into a fresh
  // V2 deal. Land/development retains its existing input semantics.
  if (mode === UI_MODE.BUILDING) delete inputs.exitCapRate;

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
  return Object.freeze({
    mode,
    ...hydrated,
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
    transactionAuthorized: false,
  });
}

function applyExitCapInputText({ inputs, rawText, min = 0, max = 1 }) {
  assertPlainObject(inputs, 'inputs');
  const parsed = parseOptionalPercentInput(rawText, { min, max });
  const nextInputs = applyOptionalPercentToInputs(inputs, 'exitCapRate', parsed);
  return Object.freeze({
    inputs: nextInputs,
    parsed,
    displayValue: formatOptionalPercentInput(nextInputs.exitCapRate),
    exitCapPresent: parsed.present,
    transactionAuthorized: false,
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
  createUiWorkspace,
  hydrateUiDeal,
  calculateUiInvestmentState,
  applyExitCapInputText,
  buildUiDisclosureViewModel,
  prepareNewUiDealForSave,
  prepareUpdatedUiDealForSave,
  explicitlyUpgradeUiDealToV2,
};
