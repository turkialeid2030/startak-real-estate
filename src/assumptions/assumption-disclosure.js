'use strict';

const {
  ASSUMPTION_MODEL_VERSION,
  V2_APPROVED_ASSUMPTIONS,
  buildAssumptionModelDisclosure,
  normalizeAssumptionModelVersion,
} = require('./assumption-model');
const { EXIT_CAP_SOURCE } = require('../engines/valuation/exit-cap-resolver');

const EXIT_CAP_DISCLOSURE = Object.freeze({
  LEGACY_DERIVED: Object.freeze({
    ar: 'توافق قديم: تم استخدام معدل الرسملة السوقي كمعدل رسملة خروج لعدم وجود معدل خروج صريح في الصفقة القديمة.',
    en: 'Legacy compatibility: the market capitalization rate is being used as the exit capitalization rate because the legacy deal has no explicit exit cap.',
  }),
  MISSING_REQUIRED: Object.freeze({
    ar: 'معدل رسملة الخروج مطلوب في إصدار الافتراضات V2. لا تُحتسب مؤشرات العائد المعتمدة على الخروج حتى إدخاله صراحةً.',
    en: 'An explicit exit capitalization rate is required under Assumption Model V2. Exit-dependent return metrics remain unavailable until it is provided.',
  }),
});

function buildAssumptionDisclosureEnvelope({ assumptionModelVersion, exitCapSource = null } = {}) {
  const version = normalizeAssumptionModelVersion(assumptionModelVersion);
  const modelDisclosure = buildAssumptionModelDisclosure(version);
  const approvedAssumptionKeys = version === ASSUMPTION_MODEL_VERSION.V2
    ? Object.freeze(Object.keys(V2_APPROVED_ASSUMPTIONS))
    : Object.freeze([]);

  let exitCapNotice = null;
  if (exitCapSource === EXIT_CAP_SOURCE.LEGACY_DERIVED) exitCapNotice = EXIT_CAP_DISCLOSURE.LEGACY_DERIVED;
  if (exitCapSource === EXIT_CAP_SOURCE.MISSING_REQUIRED) exitCapNotice = EXIT_CAP_DISCLOSURE.MISSING_REQUIRED;

  const requiresExplicitExitCap = version === ASSUMPTION_MODEL_VERSION.V2
    && exitCapSource === EXIT_CAP_SOURCE.MISSING_REQUIRED;

  return Object.freeze({
    schemaVersion: 1,
    assumptionModelVersion: version,
    badge: Object.freeze({
      ar: modelDisclosure.label_ar,
      en: modelDisclosure.label_en,
    }),
    legacyCompatibility: modelDisclosure.legacyCompatibility,
    userApprovedAssumptions: modelDisclosure.userApprovedAssumptions,
    approvedAssumptionKeys,
    exitCapSource,
    exitCapNotice,
    requiresExplicitExitCap,
    exportMetadata: Object.freeze({
      assumptionModelVersion: version,
      legacyCompatibility: modelDisclosure.legacyCompatibility,
      approvedAssumptionKeys,
      exitCapSource,
      exitCapRequired: requiresExplicitExitCap,
    }),
    transactionAuthorized: false,
    semantics: 'Disclosure metadata for dashboards, cash-flow views, sensitivity views, and exports. It describes the active assumption model and exit-cap provenance; it does not alter deterministic engine inputs or authorize a transaction.',
  });
}

module.exports = {
  EXIT_CAP_DISCLOSURE,
  buildAssumptionDisclosureEnvelope,
};
