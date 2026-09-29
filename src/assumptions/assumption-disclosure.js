'use strict';

const {
  ASSUMPTION_MODEL_VERSION,
  V2_CANONICAL_ASSUMPTIONS,
  buildAssumptionModelDisclosure,
  normalizeAssumptionModelVersion,
} = require('./assumption-model');
const { EXIT_CAP_SOURCE } = require('../engines/valuation/exit-cap-resolver');
const { EXIT_TRANSACTION_COST_SOURCE } = require('../engines/valuation/exit-transaction-cost-resolver');
const { LEASE_ROLL_FORWARD_STATUS } = require('../engines/valuation/existing-building-lease-roll-forward-governance');

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

const EXIT_TRANSACTION_COST_DISCLOSURE = Object.freeze({
  LEGACY_ACQUISITION_RATE_FALLBACK: Object.freeze({
    ar: 'توافق قديم: لا توجد نسبة تكلفة خروج مستقلة محفوظة، لذلك أُعيد استخدام نسبة تكلفة التصرف عند الاستحواذ للمحافظة على اقتصاديات الدراسة القديمة. هذا لا يحدد المكلّف نظامًا.',
    en: 'Legacy compatibility: no separate exit transaction-cost rate was persisted, so the acquisition transaction-cost rate is reused to preserve legacy economics. This does not determine the statutory taxpayer.',
  }),
  MISSING_REQUIRED: Object.freeze({
    ar: 'يلزم إدخال نسبة تكلفة الخروج الاقتصادية صراحةً في إصدار V2، بما في ذلك 0% إذا لم تُفترض تكلفة على البائع. لا تُحتسب مؤشرات الخروج حتى إدخالها.',
    en: 'Assumption Model V2 requires an explicit economic exit transaction-cost rate, including 0% when no seller-borne exit cost is assumed. Exit-dependent metrics remain unavailable until it is entered.',
  }),
});

const LEASE_ROLL_FORWARD_DISCLOSURE = Object.freeze({
  LEGACY_UNMODELED_ROLLOVER: Object.freeze({
    ar: 'توافق قديم: التغطية التعاقدية لا تمتد حتى سنة صافي الدخل التشغيلي المستقبلية المستخدمة في قيمة الخروج. تستمر الدراسة القديمة في إسقاط الدخل دون نموذج تجديد أو شغور أو إعادة تسعير تعاقدي. النتائج محفوظة للتوافق ولا تمثل نموذج ترحيل عقد مكتمل.',
    en: 'Legacy compatibility: contractual coverage does not extend through the forward-NOI year used for terminal value. The legacy study continues income without a contractual renewal, downtime, or rent-reset model. Results are preserved for compatibility and are not a complete lease-roll-forward model.',
  }),
  MISSING_REQUIRED: Object.freeze({
    ar: 'التغطية التعاقدية لا تمتد حتى سنة صافي الدخل التشغيلي المستقبلية N+1 اللازمة لقيمة الخروج، ولا يوجد نموذج ترحيل عقد معتمد. أوقفت مؤشرات NPV وIRR وقيمة الخروج وفترة الاسترداد بدل افتراض التجديد أو الشغور أو إعادة التسعير أو الحوافز تلقائيًا.',
    en: 'Contractual coverage does not extend through the forward Year-(N+1) NOI required for terminal value, and no governed lease-roll-forward model is available. NPV, IRR, terminal value, and post-expiry payback are held instead of inventing renewal, downtime, rent reset, or leasing incentives.',
  }),
});

const CRITICAL_OVERRIDE_DISCLOSURE = Object.freeze({
  INCOMPLETE_DOCUMENTATION: Object.freeze({
    ar: 'يوجد تجاوز لافتراض حرج دون اكتمال مصدره ومرجعه واعتماده. تبقى النتائج التحليلية ظاهرة للمراجعة، لكن القرار محجوب حتى استكمال التوثيق الصريح.',
    en: 'A critical assumption override lacks complete source, reference, or approval evidence. Analytical outputs remain visible for review, but decision readiness is blocked until explicit documentation is complete.',
  }),
});

function buildAssumptionDisclosureEnvelope({
  assumptionModelVersion,
  exitCapSource = null,
  exitTransactionCostSource = null,
  leaseRollForwardStatus = null,
  criticalAssumptionOverrideGovernance = null,
} = {}) {
  const version = normalizeAssumptionModelVersion(assumptionModelVersion);
  const modelDisclosure = buildAssumptionModelDisclosure(version, {
    criticalAssumptionOverrideGovernance,
  });
  const canonicalAssumptionKeys = version === ASSUMPTION_MODEL_VERSION.V2
    ? Object.freeze(Object.keys(V2_CANONICAL_ASSUMPTIONS))
    : Object.freeze([]);

  // Deprecated compatibility field. Code-level baseline assumptions are not
  // evidence of user, committee, valuer, lender, legal, tax, or transaction approval.
  const approvedAssumptionKeys = Object.freeze([]);

  let exitCapNotice = null;
  if (exitCapSource === EXIT_CAP_SOURCE.LEGACY_DERIVED) exitCapNotice = EXIT_CAP_DISCLOSURE.LEGACY_DERIVED;
  if (exitCapSource === EXIT_CAP_SOURCE.MISSING_REQUIRED) exitCapNotice = EXIT_CAP_DISCLOSURE.MISSING_REQUIRED;

  let exitTransactionCostNotice = null;
  if (exitTransactionCostSource === EXIT_TRANSACTION_COST_SOURCE.LEGACY_ACQUISITION_RATE_FALLBACK) {
    exitTransactionCostNotice = EXIT_TRANSACTION_COST_DISCLOSURE.LEGACY_ACQUISITION_RATE_FALLBACK;
  }
  if (exitTransactionCostSource === EXIT_TRANSACTION_COST_SOURCE.MISSING_REQUIRED) {
    exitTransactionCostNotice = EXIT_TRANSACTION_COST_DISCLOSURE.MISSING_REQUIRED;
  }

  let leaseRollForwardNotice = null;
  if (leaseRollForwardStatus === LEASE_ROLL_FORWARD_STATUS.LEGACY_UNMODELED_ROLLOVER) {
    leaseRollForwardNotice = LEASE_ROLL_FORWARD_DISCLOSURE.LEGACY_UNMODELED_ROLLOVER;
  }
  if (leaseRollForwardStatus === LEASE_ROLL_FORWARD_STATUS.MISSING_REQUIRED) {
    leaseRollForwardNotice = LEASE_ROLL_FORWARD_DISCLOSURE.MISSING_REQUIRED;
  }

  const criticalOverrideDocumentationIncomplete = !!(
    criticalAssumptionOverrideGovernance
    && criticalAssumptionOverrideGovernance.hasIncompleteCriticalOverrides === true
  );
  const criticalOverrideNotice = criticalOverrideDocumentationIncomplete
    ? CRITICAL_OVERRIDE_DISCLOSURE.INCOMPLETE_DOCUMENTATION
    : null;

  const requiresExplicitExitCap = version === ASSUMPTION_MODEL_VERSION.V2
    && exitCapSource === EXIT_CAP_SOURCE.MISSING_REQUIRED;
  const requiresExplicitExitTransactionCost = version === ASSUMPTION_MODEL_VERSION.V2
    && exitTransactionCostSource === EXIT_TRANSACTION_COST_SOURCE.MISSING_REQUIRED;
  const requiresLeaseRollForward = version === ASSUMPTION_MODEL_VERSION.V2
    && leaseRollForwardStatus === LEASE_ROLL_FORWARD_STATUS.MISSING_REQUIRED;

  return Object.freeze({
    schemaVersion: 4,
    assumptionModelVersion: version,
    badge: Object.freeze({
      ar: modelDisclosure.label_ar,
      en: modelDisclosure.label_en,
    }),
    legacyCompatibility: modelDisclosure.legacyCompatibility,
    userApprovedAssumptions: false,
    canonicalBaselineIsApprovalEvidence: false,
    canonicalAssumptionKeys,
    approvedAssumptionKeys,
    criticalOverridesPresent: modelDisclosure.criticalOverridesPresent,
    criticalOverridesDocumentationComplete: modelDisclosure.criticalOverridesDocumentationComplete,
    criticalOverrideApprovalEvidenceStatus: modelDisclosure.criticalOverrideApprovalEvidenceStatus,
    criticalOverrideDocumentationIncomplete,
    criticalOverrideNotice,
    exitCapSource,
    exitCapNotice,
    requiresExplicitExitCap,
    exitTransactionCostSource,
    exitTransactionCostNotice,
    requiresExplicitExitTransactionCost,
    leaseRollForwardStatus,
    leaseRollForwardNotice,
    requiresLeaseRollForward,
    exportMetadata: Object.freeze({
      assumptionModelVersion: version,
      legacyCompatibility: modelDisclosure.legacyCompatibility,
      canonicalBaselineIsApprovalEvidence: false,
      canonicalAssumptionKeys,
      approvedAssumptionKeys,
      criticalOverridesPresent: modelDisclosure.criticalOverridesPresent,
      criticalOverridesDocumentationComplete: modelDisclosure.criticalOverridesDocumentationComplete,
      criticalOverrideApprovalEvidenceStatus: modelDisclosure.criticalOverrideApprovalEvidenceStatus,
      criticalOverrideDocumentationIncomplete,
      exitCapSource,
      exitCapRequired: requiresExplicitExitCap,
      exitTransactionCostSource,
      exitTransactionCostRequired: requiresExplicitExitTransactionCost,
      leaseRollForwardStatus,
      leaseRollForwardRequired: requiresLeaseRollForward,
    }),
    transactionAuthorized: false,
    semantics: 'Disclosure metadata for dashboards, cash-flow views, sensitivity views, and exports. V2 code defaults are canonical analytical baseline assumptions, not approval evidence. Critical overrides require explicit provenance and approval evidence for decision readiness. This disclosure does not determine statutory tax incidence, invent post-expiry lease economics, authorize a transaction, activate the canonical baseline, or authorize Commercial Go-Live.',
  });
}

module.exports = {
  EXIT_CAP_DISCLOSURE,
  EXIT_TRANSACTION_COST_DISCLOSURE,
  LEASE_ROLL_FORWARD_DISCLOSURE,
  CRITICAL_OVERRIDE_DISCLOSURE,
  buildAssumptionDisclosureEnvelope,
};
