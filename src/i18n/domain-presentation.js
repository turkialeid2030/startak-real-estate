// src/i18n/domain-presentation.js -- centralized RAW-ENGINE-VALUE -> DISPLAY
// mapping. Presentation only: this module must never drive calculation logic.
//
// IMPORTANT CONTRACT:
// getVerdictLabel() is the legacy characterization/i18n presentation contract.
// It intentionally preserves the historical localized labels so existing
// regression evidence remains valid. Customer-facing decision-support surfaces
// MUST use getExternalDecisionSupportVerdictLabel(), which applies the
// Compliance Guard vocabulary. This separation prevents regulated-style UI
// claims without rewriting historical engine/i18n semantics.
const {
  externalizeInternalVerdict,
  renderDecisionSupportLabel,
} = require('../compliance/decision-support.js');

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

// Backward-compatible localization contract used by characterization tests and
// internal/legacy views. Do not use this function for new customer-facing
// decision-support output.
function getVerdictLabel(rawVerdict, t) {
  return t(assertKnownVerdict(rawVerdict));
}

// Compliance-bounded external presentation for all new/customer-facing views.
function getExternalDecisionSupportVerdictLabel(rawVerdict, t, options = {}) {
  const key = assertKnownVerdict(rawVerdict);
  const translatedLegacyLabel = t(key);
  const locale = /[\u0600-\u06FF]/.test(translatedLegacyLabel) ? 'ar' : 'en';
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
