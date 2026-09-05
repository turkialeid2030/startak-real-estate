// src/i18n/domain-presentation.js -- centralized RAW-ENGINE-VALUE -> DISPLAY
// mapping. Presentation only: this module must never drive calculation logic.
//
// IMPORTANT CONTRACT:
// getVerdictLabel() defaults to the legacy characterization/i18n presentation
// contract so historical regression evidence remains valid. The production UI
// explicitly activates EXTERNAL_DECISION_SUPPORT mode before render, causing the
// same presentation call site to route through Compliance Guard vocabulary.
// Engine semantics and raw verdict values are never changed by this module.
const {
  externalizeInternalVerdict,
  renderDecisionSupportLabel,
} = require('../compliance/decision-support.js');

const VERDICT_PRESENTATION_MODE = Object.freeze({
  LEGACY_CHARACTERIZATION: 'LEGACY_CHARACTERIZATION',
  EXTERNAL_DECISION_SUPPORT: 'EXTERNAL_DECISION_SUPPORT',
});

let activeVerdictPresentationMode = VERDICT_PRESENTATION_MODE.LEGACY_CHARACTERIZATION;

// Historical engine recommendation vocabulary remains exactly three values.
// Wave-2 INCOMPLETE_INPUTS is a fail-closed readiness state, not a fourth legacy
// recommendation. It is handled explicitly below so characterization coverage
// and existing recommendation-domain invariants remain unchanged.
const VERDICT_PRESENTATION_KEYS = {
  "يوصى بالشراء": "recommendation.buy",
  "يوصى بالشراء بشروط": "recommendation.conditionalBuy",
  "لا يوصى بالشراء": "recommendation.noBuy",
};

function assertKnownVerdict(rawVerdict) {
  const key = VERDICT_PRESENTATION_KEYS[rawVerdict];
  if (!key) {
    throw new Error(`Unmapped recommendation verdict: "${rawVerdict}" -- the engine returned a value not present in VERDICT_PRESENTATION_KEYS. This must be fixed in domain-presentation.js, not silently displayed.`);
  }
  return key;
}

function detectPresentationLocale(t) {
  // Use established translated signals. Some characterization translators stub
  // recommendation keys while Wave-2 tests stub app.title, so accept either
  // signal without weakening the strict raw-verdict mapping contract.
  const signals = [t('recommendation.buy'), t('app.title')].map((value) => String(value || ''));
  return signals.some((value) => /[\u0600-\u06FF]/.test(value)) ? 'ar' : 'en';
}

function renderIncompleteInputsLabel(t) {
  const locale = detectPresentationLocale(t);
  const analyticalLabel = externalizeInternalVerdict('INCOMPLETE_INPUTS', { locale });
  return renderDecisionSupportLabel(analyticalLabel, locale);
}

function setVerdictPresentationMode(mode) {
  if (!Object.values(VERDICT_PRESENTATION_MODE).includes(mode)) {
    throw new Error(`Unsupported verdict presentation mode: ${mode}`);
  }
  activeVerdictPresentationMode = mode;
  return activeVerdictPresentationMode;
}

function getVerdictPresentationMode() {
  return activeVerdictPresentationMode;
}

// Backward-compatible localization contract by default. Once the production UI
// explicitly activates EXTERNAL_DECISION_SUPPORT mode, this same call site is
// compliance-bounded without changing calculation or raw recommendation fields.
function getVerdictLabel(rawVerdict, t) {
  if (rawVerdict === 'INCOMPLETE_INPUTS') return renderIncompleteInputsLabel(t);
  const key = assertKnownVerdict(rawVerdict);
  if (activeVerdictPresentationMode === VERDICT_PRESENTATION_MODE.EXTERNAL_DECISION_SUPPORT) {
    return getExternalDecisionSupportVerdictLabel(rawVerdict, t);
  }
  return t(key);
}

// Compliance-bounded external presentation for customer-facing views.
function getExternalDecisionSupportVerdictLabel(rawVerdict, t, options = {}) {
  if (rawVerdict === 'INCOMPLETE_INPUTS') return renderIncompleteInputsLabel(t);
  assertKnownVerdict(rawVerdict);
  const locale = detectPresentationLocale(t);
  const analyticalLabel = externalizeInternalVerdict(rawVerdict, { locale, ...options });
  return renderDecisionSupportLabel(analyticalLabel, locale);
}

const BUILDING_PERMIT_STATUS_PRESENTATION_KEYS = {
  "لم يُستخرج": "dashboardR3.buildingPermitStatus.notIssued",
  "قيد الإجراء": "dashboardR3.buildingPermitStatus.inProgress",
  "صادر": "dashboardR3.buildingPermitStatus.issued",
};

function getBuildingPermitStatusLabel(rawStatus, t) {
  const key = BUILDING_PERMIT_STATUS_PRESENTATION_KEYS[rawStatus];
  if (!key) {
    throw new Error(`Unmapped building permit status: "${rawStatus}" -- not present in BUILDING_PERMIT_STATUS_PRESENTATION_KEYS. Fix in domain-presentation.js, never silently display the raw value.`);
  }
  return t(key);
}

const LEASE_STATUS_PRESENTATION_KEYS = {
  "مؤجر": "dashboardR3.leaseStatus.leased",
  "3 أشهر": "dashboardR3.leaseStatus.months3",
  "6 أشهر": "dashboardR3.leaseStatus.months6",
  "9 أشهر": "dashboardR3.leaseStatus.months9",
  "سنة": "dashboardR3.leaseStatus.year",
};
function getLeaseStatusLabel(rawStatus, t) {
  const key = LEASE_STATUS_PRESENTATION_KEYS[rawStatus];
  if (!key) throw new Error(`Unmapped lease status: "${rawStatus}" -- not present in LEASE_STATUS_PRESENTATION_KEYS.`);
  return t(key);
}

const BUILDING_TYPE_PRESENTATION_KEYS = {
  "برج مكتبي": "dashboardR3.buildingType.officeTower",
  "برج سكني": "dashboardR3.buildingType.residentialTower",
  "مبنى تجاري": "dashboardR3.buildingType.commercialBuilding",
  "استخدام مختلط": "dashboardR3.buildingType.mixedUse",
};
function getBuildingTypeLabel(rawType, t) {
  const key = BUILDING_TYPE_PRESENTATION_KEYS[rawType];
  if (!key) throw new Error(`Unmapped building type: "${rawType}" -- not present in BUILDING_TYPE_PRESENTATION_KEYS.`);
  return t(key);
}

const FINANCING_STRUCTURE_PRESENTATION_KEYS = {
  "مرابحة": "financingInput.structure.murabaha",
  "إجارة منتهية بالتمليك": "financingInput.structure.ijara",
};
function getFinancingStructureLabel(rawStructure, t) {
  const key = FINANCING_STRUCTURE_PRESENTATION_KEYS[rawStructure];
  if (!key) throw new Error(`Unmapped financing structure: "${rawStructure}" -- not present in FINANCING_STRUCTURE_PRESENTATION_KEYS.`);
  return t(key);
}

function getDealDisplayName(deal, t) {
  if (deal.name === "صفقة") return t("savedDeals.systemDefaultDealName");
  return deal.name;
}

function getProjectTitleDisplay(projectTitle, t) {
  if (projectTitle === "مبنى مكتبي قائم — طريق أبو بكر الصديق، حي الندى، الرياض") return t("globalApp.defaultProjectTitleBuilding");
  if (projectTitle === "أرض للتطوير — الدائري الشرقي، حي الوادي") return t("globalApp.defaultProjectTitleLand");
  return projectTitle;
}

module.exports = {
  getVerdictLabel,
  getExternalDecisionSupportVerdictLabel,
  setVerdictPresentationMode,
  getVerdictPresentationMode,
  VERDICT_PRESENTATION_MODE,
  VERDICT_PRESENTATION_KEYS,
  getBuildingPermitStatusLabel,
  BUILDING_PERMIT_STATUS_PRESENTATION_KEYS,
  getLeaseStatusLabel,
  LEASE_STATUS_PRESENTATION_KEYS,
  getBuildingTypeLabel,
  BUILDING_TYPE_PRESENTATION_KEYS,
  getFinancingStructureLabel,
  FINANCING_STRUCTURE_PRESENTATION_KEYS,
  getDealDisplayName,
  getProjectTitleDisplay,
};
