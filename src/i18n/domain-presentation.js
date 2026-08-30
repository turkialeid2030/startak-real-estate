// src/i18n/domain-presentation.js -- centralized RAW-ENGINE-VALUE -> DISPLAY
// mapping. This is the ONLY place that maps a raw recommendation verdict
// string to a translation key. It must NEVER be imported by src/engines/**
// or used to drive any decision logic -- presentation only.
//
// Discovered directly from src/engines/recommendation/index.js's tierVerdict()
// (verbatim-extracted, never modified): exactly 3 possible raw values.
const VERDICT_PRESENTATION_KEYS = {
  "يوصى بالشراء": "recommendation.buy",
  "يوصى بالشراء بشروط": "recommendation.conditionalBuy",
  "لا يوصى بالشراء": "recommendation.noBuy",
};

function getVerdictLabel(rawVerdict, t) {
  const key = VERDICT_PRESENTATION_KEYS[rawVerdict];
  if (!key) {
    throw new Error(`Unmapped recommendation verdict: "${rawVerdict}" -- the engine returned a value not present in VERDICT_PRESENTATION_KEYS. This must be fixed in domain-presentation.js, not silently displayed.`);
  }
  return t(key);
}

// R3V: same architecture, for the Land regulatory card's building-permit
// status field. Discovered as a genuine CONTROLLED_ENUM (SelectField with
// exactly 3 fixed options at src/app/App.jsx line 1069) -- not free text.
// The raw value continues to drive `checked: inputs.buildingPermitStatus
// === "صادر"` unchanged; only the DISPLAY label is localized.
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

// R5-C: same architecture, for leaseStatus and buildingTypeLabel SelectField
// options. Both are DISPLAY_ONLY (zero raw comparisons found anywhere in
// source), but still use the raw-key mapping pattern for consistency and to
// guard against future silent-fallback bugs if either ever becomes semantic.
const LEASE_STATUS_PRESENTATION_KEYS = {
  "مؤجر": "dashboardR3.leaseStatus.leased",
  "3 أشهر": "dashboardR3.leaseStatus.months3",
  "6 أشهر": "dashboardR3.leaseStatus.months6",
  "9 أشهر": "dashboardR3.leaseStatus.months9",
  "سنة": "dashboardR3.leaseStatus.year",
};
function getLeaseStatusLabel(rawStatus, t) {
  const key = LEASE_STATUS_PRESENTATION_KEYS[rawStatus];
  if (!key) {
    throw new Error(`Unmapped lease status: "${rawStatus}" -- not present in LEASE_STATUS_PRESENTATION_KEYS.`);
  }
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
  if (!key) {
    throw new Error(`Unmapped building type: "${rawType}" -- not present in BUILDING_TYPE_PRESENTATION_KEYS.`);
  }
  return t(key);
}

// R5-D: financingStructureLabel is DISPLAY_ONLY (zero raw === comparisons
// found anywhere in source), but uses the same raw-key mapping pattern for
// consistency with leaseStatus/buildingTypeLabel/buildingPermitStatus.
const FINANCING_STRUCTURE_PRESENTATION_KEYS = {
  "مرابحة": "financingInput.structure.murabaha",
  "إجارة منتهية بالتمليك": "financingInput.structure.ijara",
};
function getFinancingStructureLabel(rawStructure, t) {
  const key = FINANCING_STRUCTURE_PRESENTATION_KEYS[rawStructure];
  if (!key) {
    throw new Error(`Unmapped financing structure: "${rawStructure}" -- not present in FINANCING_STRUCTURE_PRESENTATION_KEYS.`);
  }
  return t(key);
}

// R6-A: "صفقة" is a SYSTEM_GENERATED_PERSISTED_LABEL, never user-entered --
// confirmed by source review: the only write site for this exact literal is
// updateActiveDeal()'s defensive fallback (`existing ? existing.name :
// "صفقة"`), reachable only if activeDealId points to a deal no longer found
// in savedDeals (a rare cross-tab/session race, not a normal user path). The
// "Save New" button is disabled while saveNameInput is empty, so a user can
// never directly create a deal named "صفقة" through the primary save flow.
// Raw persisted value is NEVER touched; only the display for this one exact
// literal is mapped. Any other name (real user content) passes through
// unchanged via the `: deal.name` branch.
function getDealDisplayName(deal, t) {
  if (deal.name === "صفقة") return t("savedDeals.systemDefaultDealName");
  return deal.name;
}

// I18N_FULL: same pattern -- projectTitle is a SYSTEM_GENERATED default long
// descriptive string inside DEFAULT_BUILDING_INPUTS/DEFAULT_LAND_INPUTS,
// displayed directly as the page header (App.jsx line ~1533). It is a free-
// text user-editable field (not a controlled enum), so an edited value must
// pass through unchanged; only the exact known default strings map to a
// localized display, mirroring getDealDisplayName's exact-literal-match
// approach. Raw persisted/state value is NEVER touched.
function getProjectTitleDisplay(projectTitle, t) {
  if (projectTitle === "مبنى مكتبي قائم — طريق أبو بكر الصديق، حي الندى، الرياض") return t("globalApp.defaultProjectTitleBuilding");
  if (projectTitle === "أرض للتطوير — الدائري الشرقي، حي الوادي") return t("globalApp.defaultProjectTitleLand");
  return projectTitle;
}

module.exports = { getVerdictLabel, VERDICT_PRESENTATION_KEYS, getBuildingPermitStatusLabel, BUILDING_PERMIT_STATUS_PRESENTATION_KEYS, getLeaseStatusLabel, LEASE_STATUS_PRESENTATION_KEYS, getBuildingTypeLabel, BUILDING_TYPE_PRESENTATION_KEYS, getFinancingStructureLabel, FINANCING_STRUCTURE_PRESENTATION_KEYS, getDealDisplayName, getProjectTitleDisplay };
