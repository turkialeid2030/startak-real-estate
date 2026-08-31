'use strict';

const OPERATING_MODE = Object.freeze({
  UNLICENSED_DECISION_SUPPORT: 'UNLICENSED_DECISION_SUPPORT',
  LICENSED_PROVIDER: 'LICENSED_PROVIDER',
});

const EXTERNAL_DECISION_LABEL = Object.freeze({
  FAVOURABLE_ANALYTICAL_CASE: 'FAVOURABLE_ANALYTICAL_CASE',
  CONDITIONAL: 'CONDITIONAL',
  HIGH_RISK: 'HIGH_RISK',
  HOLD_EVIDENCE: 'HOLD_EVIDENCE',
  REQUIRES_LICENSED_REVIEW: 'REQUIRES_LICENSED_REVIEW',
});

const PROHIBITED_EXTERNAL_OUTPUT = Object.freeze(new Set([
  'CERTIFIED_VALUATION',
  'LEGAL_OPINION',
  'REGULATED_INVESTMENT_ADVICE',
  'BROKER_RECOMMENDATION',
  'BUY',
  'SELL',
  'APPROVE',
  'REJECT',
]));

const INTERNAL_VERDICT_MAP = Object.freeze({
  'يوصى بالشراء': EXTERNAL_DECISION_LABEL.FAVOURABLE_ANALYTICAL_CASE,
  'يوصى بالشراء بشروط': EXTERNAL_DECISION_LABEL.CONDITIONAL,
  'لا يوصى بالشراء': EXTERNAL_DECISION_LABEL.HIGH_RISK,
});

const DECISION_LABEL_TEXT = Object.freeze({
  ar: Object.freeze({
    [EXTERNAL_DECISION_LABEL.FAVOURABLE_ANALYTICAL_CASE]: 'حالة تحليلية مواتية',
    [EXTERNAL_DECISION_LABEL.CONDITIONAL]: 'حالة تحليلية مشروطة',
    [EXTERNAL_DECISION_LABEL.HIGH_RISK]: 'مخاطر تحليلية مرتفعة',
    [EXTERNAL_DECISION_LABEL.HOLD_EVIDENCE]: 'تعليق التحليل لحين استكمال الأدلة',
    [EXTERNAL_DECISION_LABEL.REQUIRES_LICENSED_REVIEW]: 'يتطلب مراجعة مختص مرخص',
  }),
  en: Object.freeze({
    [EXTERNAL_DECISION_LABEL.FAVOURABLE_ANALYTICAL_CASE]: 'Favourable Analytical Case',
    [EXTERNAL_DECISION_LABEL.CONDITIONAL]: 'Conditional Analytical Case',
    [EXTERNAL_DECISION_LABEL.HIGH_RISK]: 'High Analytical Risk',
    [EXTERNAL_DECISION_LABEL.HOLD_EVIDENCE]: 'Hold Pending Evidence',
    [EXTERNAL_DECISION_LABEL.REQUIRES_LICENSED_REVIEW]: 'Requires Licensed Review',
  }),
});

const FULL_SCOPE_NOTICE = Object.freeze({
  ar: 'أداة دعم قرار وتحليل معلوماتي وليست استشارة عقارية مرخصة أو تقييماً عقارياً معتمداً أو رأياً قانونياً أو توصية استثمارية ملزمة. تعتمد النتائج على البيانات والافتراضات المتاحة، ويجب التحقق منها ومراجعة المسائل التي تتطلب ترخيصاً أو رأياً مهنياً لدى المختص المرخص قبل اتخاذ القرار أو إتمام أي تصرف.',
  en: 'Decision-support and information-analysis tool only. It is not licensed real-estate consultancy, a certified appraisal, a legal opinion, or binding investment advice. Results depend on available data and assumptions and must be independently verified; matters requiring professional licensing or legal interpretation must be reviewed by the appropriate licensed professional before any final decision or transaction.',
});

function normalizeLocale(locale) {
  return String(locale || '').toLowerCase().startsWith('en') ? 'en' : 'ar';
}

function externalizeInternalVerdict(rawVerdict, {
  mode = OPERATING_MODE.UNLICENSED_DECISION_SUPPORT,
  locale = 'ar',
  evidenceReady = true,
  requiresLicensedReview = false,
} = {}) {
  if (mode === OPERATING_MODE.LICENSED_PROVIDER) {
    throw new Error('LICENSED_PROVIDER mode is not enabled by this module. A separately governed licensed-provider workflow is required.');
  }
  if (requiresLicensedReview) return EXTERNAL_DECISION_LABEL.REQUIRES_LICENSED_REVIEW;
  if (!evidenceReady) return EXTERNAL_DECISION_LABEL.HOLD_EVIDENCE;
  const label = INTERNAL_VERDICT_MAP[rawVerdict];
  if (!label) throw new Error(`UNMAPPED_INTERNAL_VERDICT: ${rawVerdict}`);
  return label;
}

function renderDecisionSupportLabel(label, locale = 'ar') {
  if (!Object.values(EXTERNAL_DECISION_LABEL).includes(label)) {
    throw new TypeError(`Invalid decision-support label: ${label}`);
  }
  return DECISION_LABEL_TEXT[normalizeLocale(locale)][label];
}

function assertPermittedExternalOutput(outputType, {
  mode = OPERATING_MODE.UNLICENSED_DECISION_SUPPORT,
} = {}) {
  if (mode === OPERATING_MODE.UNLICENSED_DECISION_SUPPORT && PROHIBITED_EXTERNAL_OUTPUT.has(outputType)) {
    const error = new Error(`COMPLIANCE_GUARD_BLOCKED_OUTPUT: ${outputType}`);
    error.code = 'COMPLIANCE_GUARD_BLOCKED_OUTPUT';
    error.outputType = outputType;
    throw error;
  }
  return true;
}

function createDecisionSupportEnvelope({
  analyticalLabel,
  locale = 'ar',
  assumptions = [],
  evidenceGaps = [],
  licensedReviewRequired = false,
}) {
  const normalizedLocale = normalizeLocale(locale);
  return Object.freeze({
    schemaVersion: 1,
    operatingMode: OPERATING_MODE.UNLICENSED_DECISION_SUPPORT,
    outputType: 'ANALYTICAL_INDICATION',
    analyticalLabel,
    displayLabel: renderDecisionSupportLabel(analyticalLabel, normalizedLocale),
    assumptions: Object.freeze(assumptions.map(String)),
    evidenceGaps: Object.freeze(evidenceGaps.map(String)),
    licensedReviewRequired: Boolean(licensedReviewRequired),
    scopeNotice: FULL_SCOPE_NOTICE[normalizedLocale],
    semantics: 'This envelope is analytical decision support only. It is not a licensed professional opinion, certified appraisal, brokerage recommendation, transaction instruction, or binding investment advice.',
  });
}

module.exports = {
  OPERATING_MODE,
  EXTERNAL_DECISION_LABEL,
  PROHIBITED_EXTERNAL_OUTPUT,
  FULL_SCOPE_NOTICE,
  externalizeInternalVerdict,
  renderDecisionSupportLabel,
  assertPermittedExternalOutput,
  createDecisionSupportEnvelope,
};
