'use strict';

const OPERATING_MODE = Object.freeze({
  UNLICENSED_DECISION_SUPPORT: 'UNLICENSED_DECISION_SUPPORT',
  LICENSED_PROVIDER: 'LICENSED_PROVIDER',
});

const DECISION_SUPPORT_OUTPUT_TYPE = Object.freeze({
  ANALYTICAL_INDICATION: 'ANALYTICAL_INDICATION',
  SCREENING_RESULT: 'SCREENING_RESULT',
  SCENARIO_RESULT: 'SCENARIO_RESULT',
  RISK_FLAG: 'RISK_FLAG',
  EVIDENCE_GAP: 'EVIDENCE_GAP',
  REQUIRES_LICENSED_REVIEW: 'REQUIRES_LICENSED_REVIEW',
});

const EXTERNAL_DECISION_LABEL = Object.freeze({
  FAVOURABLE_ANALYTICAL_CASE: 'FAVOURABLE_ANALYTICAL_CASE',
  CONDITIONAL: 'CONDITIONAL',
  HIGH_RISK: 'HIGH_RISK',
  HOLD_EVIDENCE: 'HOLD_EVIDENCE',
  INCOMPLETE_INPUTS: 'INCOMPLETE_INPUTS',
  REQUIRES_LICENSED_REVIEW: 'REQUIRES_LICENSED_REVIEW',
});

const VALUATION_STATUS = Object.freeze({
  NON_CERTIFIED_ANALYTICAL_INDICATION: 'NON_CERTIFIED_ANALYTICAL_INDICATION',
  REQUIRES_LICENSED_VALUER_REVIEW: 'REQUIRES_LICENSED_VALUER_REVIEW',
});

const LEGAL_REVIEW_STATUS = Object.freeze({
  FACTUAL_EXTRACTION_ONLY: 'FACTUAL_EXTRACTION_ONLY',
  LEGAL_REVIEW_REQUIRED: 'LEGAL_REVIEW_REQUIRED',
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
  INCOMPLETE_INPUTS: EXTERNAL_DECISION_LABEL.INCOMPLETE_INPUTS,
});

const DECISION_LABEL_TEXT = Object.freeze({
  ar: Object.freeze({
    [EXTERNAL_DECISION_LABEL.FAVOURABLE_ANALYTICAL_CASE]: 'حالة تحليلية مواتية',
    [EXTERNAL_DECISION_LABEL.CONDITIONAL]: 'حالة تحليلية مشروطة',
    [EXTERNAL_DECISION_LABEL.HIGH_RISK]: 'مخاطر تحليلية مرتفعة',
    [EXTERNAL_DECISION_LABEL.HOLD_EVIDENCE]: 'تعليق التحليل لحين استكمال الأدلة',
    [EXTERNAL_DECISION_LABEL.INCOMPLETE_INPUTS]: 'المدخلات غير مكتملة — يلزم استكمال الافتراضات المطلوبة',
    [EXTERNAL_DECISION_LABEL.REQUIRES_LICENSED_REVIEW]: 'يتطلب مراجعة مختص مرخص',
  }),
  en: Object.freeze({
    [EXTERNAL_DECISION_LABEL.FAVOURABLE_ANALYTICAL_CASE]: 'Favourable Analytical Case',
    [EXTERNAL_DECISION_LABEL.CONDITIONAL]: 'Conditional Analytical Case',
    [EXTERNAL_DECISION_LABEL.HIGH_RISK]: 'High Analytical Risk',
    [EXTERNAL_DECISION_LABEL.HOLD_EVIDENCE]: 'Hold Pending Evidence',
    [EXTERNAL_DECISION_LABEL.INCOMPLETE_INPUTS]: 'Incomplete Inputs — Required Assumptions Must Be Completed',
    [EXTERNAL_DECISION_LABEL.REQUIRES_LICENSED_REVIEW]: 'Requires Licensed Review',
  }),
});

const FULL_SCOPE_NOTICE = Object.freeze({
  ar: 'أداة دعم قرار وتحليل معلوماتي وليست استشارة عقارية مرخصة أو تقييماً عقارياً معتمداً أو رأياً قانونياً أو توصية استثمارية ملزمة. تعتمد النتائج على البيانات والافتراضات المتاحة، ويجب التحقق منها ومراجعة المسائل التي تتطلب ترخيصاً أو رأياً مهنياً لدى المختص المرخص قبل اتخاذ القرار أو إتمام أي تصرف.',
  en: 'Decision-support and information-analysis tool only. It is not licensed real-estate consultancy, a certified appraisal, a legal opinion, or binding investment advice. Results depend on available data and assumptions and must be independently verified; matters requiring professional licensing or legal interpretation must be reviewed by the appropriate licensed professional before any final decision or transaction.',
});

const SHORT_SCOPE_NOTICE = Object.freeze({
  ar: 'تحليل داعم للقرار — غير مرخص كاستشارة أو تقييم معتمد.',
  en: 'Decision-support analysis — not licensed as consultancy or certified valuation.',
});

function normalizeLocale(locale) {
  return String(locale || '').toLowerCase().startsWith('en') ? 'en' : 'ar';
}

function cleanStringList(values) {
  return Object.freeze((Array.isArray(values) ? values : []).map(String));
}

function cleanEvidenceProvenance(values) {
  return Object.freeze((Array.isArray(values) ? values : []).map((item) => Object.freeze({
    source: item?.source ? String(item.source) : null,
    sourceDate: item?.sourceDate ? String(item.sourceDate) : null,
    extractionMethod: item?.extractionMethod ? String(item.extractionMethod) : null,
    confidence: item?.confidence ? String(item.confidence) : null,
    qualificationStatus: item?.qualificationStatus ? String(item.qualificationStatus) : null,
    contradictionState: item?.contradictionState ? String(item.contradictionState) : null,
  })));
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

function assertDecisionSupportOutputType(outputType) {
  assertPermittedExternalOutput(outputType);
  if (!Object.values(DECISION_SUPPORT_OUTPUT_TYPE).includes(outputType)) {
    const error = new Error(`UNSUPPORTED_DECISION_SUPPORT_OUTPUT_TYPE: ${outputType}`);
    error.code = 'UNSUPPORTED_DECISION_SUPPORT_OUTPUT_TYPE';
    throw error;
  }
  return true;
}

function createDecisionSupportEnvelope({
  analyticalLabel,
  locale = 'ar',
  assumptions = [],
  evidenceGaps = [],
  evidenceProvenance = [],
  licensedReviewRequired = false,
  outputType = DECISION_SUPPORT_OUTPUT_TYPE.ANALYTICAL_INDICATION,
  valuationStatus = VALUATION_STATUS.NON_CERTIFIED_ANALYTICAL_INDICATION,
}) {
  assertDecisionSupportOutputType(outputType);
  const normalizedLocale = normalizeLocale(locale);
  const requiresReview = Boolean(licensedReviewRequired) || outputType === DECISION_SUPPORT_OUTPUT_TYPE.REQUIRES_LICENSED_REVIEW;
  return Object.freeze({
    schemaVersion: 2,
    operatingMode: OPERATING_MODE.UNLICENSED_DECISION_SUPPORT,
    outputType,
    analyticalLabel,
    displayLabel: renderDecisionSupportLabel(analyticalLabel, normalizedLocale),
    assumptions: cleanStringList(assumptions),
    evidenceGaps: cleanStringList(evidenceGaps),
    evidenceProvenance: cleanEvidenceProvenance(evidenceProvenance),
    licensedReviewRequired: requiresReview,
    valuationStatus,
    certifiedValuation: false,
    legalOpinionEstablished: false,
    transactionAuthorized: false,
    shortScopeNotice: SHORT_SCOPE_NOTICE[normalizedLocale],
    scopeNotice: FULL_SCOPE_NOTICE[normalizedLocale],
    semantics: 'This envelope is analytical decision support only. It is not a licensed professional opinion, certified appraisal, brokerage recommendation, transaction instruction, or binding investment advice.',
  });
}

function createValuationIndicationEnvelope(options = {}) {
  const licensedReviewRequired = Boolean(options.licensedReviewRequired);
  return createDecisionSupportEnvelope({
    ...options,
    outputType: licensedReviewRequired
      ? DECISION_SUPPORT_OUTPUT_TYPE.REQUIRES_LICENSED_REVIEW
      : DECISION_SUPPORT_OUTPUT_TYPE.ANALYTICAL_INDICATION,
    valuationStatus: licensedReviewRequired
      ? VALUATION_STATUS.REQUIRES_LICENSED_VALUER_REVIEW
      : VALUATION_STATUS.NON_CERTIFIED_ANALYTICAL_INDICATION,
    licensedReviewRequired,
  });
}

function createLegalTitleBoundary({ facts = [], inconsistencies = [], interpretationRequired = false } = {}) {
  return Object.freeze({
    schemaVersion: 1,
    operatingMode: OPERATING_MODE.UNLICENSED_DECISION_SUPPORT,
    outputType: interpretationRequired
      ? DECISION_SUPPORT_OUTPUT_TYPE.REQUIRES_LICENSED_REVIEW
      : DECISION_SUPPORT_OUTPUT_TYPE.SCREENING_RESULT,
    legalReviewStatus: interpretationRequired
      ? LEGAL_REVIEW_STATUS.LEGAL_REVIEW_REQUIRED
      : LEGAL_REVIEW_STATUS.FACTUAL_EXTRACTION_ONLY,
    facts: Object.freeze((Array.isArray(facts) ? facts : []).map((item) => Object.freeze({ ...item }))),
    inconsistencies: cleanStringList(inconsistencies),
    legalConclusion: null,
    legalOpinionEstablished: false,
    licensedReviewRequired: Boolean(interpretationRequired),
    transactionAuthorized: false,
    semantics: 'Factual title/document extraction only. Legal validity, enforceability, transaction safety, or legal interpretation is never established by this software.',
  });
}

module.exports = {
  OPERATING_MODE,
  DECISION_SUPPORT_OUTPUT_TYPE,
  EXTERNAL_DECISION_LABEL,
  VALUATION_STATUS,
  LEGAL_REVIEW_STATUS,
  PROHIBITED_EXTERNAL_OUTPUT,
  FULL_SCOPE_NOTICE,
  SHORT_SCOPE_NOTICE,
  externalizeInternalVerdict,
  renderDecisionSupportLabel,
  assertPermittedExternalOutput,
  assertDecisionSupportOutputType,
  createDecisionSupportEnvelope,
  createValuationIndicationEnvelope,
  createLegalTitleBoundary,
};
