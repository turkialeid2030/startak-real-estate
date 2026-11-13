'use strict';

const FINANCIAL_SCOPE_NOTICE = Object.freeze({
  en: 'This result is financial analysis supporting a decision. It is not legal or regulatory approval, an accredited real-estate valuation, or authority to execute a transaction.',
  ar: 'هذه النتيجة تحليل مالي داعم للقرار ولا تمثل اعتمادًا قانونيًا أو نظاميًا أو تقييمًا عقاريًا معتمدًا أو تفويضًا بتنفيذ الصفقة.',
});

const recommendationMethodologyMetadata = Object.freeze({
  modelVersion: 'decision-governance-v1',
  effectiveDate: '2026-09-15',
  decisionScope: 'REAL_ESTATE_INVESTMENT_DECISION_SUPPORT',
  hardGates: Object.freeze([
    'FINANCIAL_HARD_GATES', 'VALUATION_READINESS', 'EVIDENCE_READINESS',
    'LEGAL_DUE_DILIGENCE', 'REGULATORY_DUE_DILIGENCE', 'TECHNICAL_DUE_DILIGENCE',
    'FINANCING_HARD_GATES', 'CRITICAL_RISK_FLAGS', 'REQUIRED_APPROVALS',
  ]),
  softCriteria: Object.freeze([]),
  weights: Object.freeze({}),
  financingGates: Object.freeze(['DSCR', 'LOAN_INPUT_VALIDITY', 'LEVERED_NPV']),
  requiredEvidence: Object.freeze(['SOURCE', 'SOURCE_DATE', 'EVIDENCE_GRADE', 'CRITICAL_EVIDENCE_COMPLETENESS']),
  financialResultLabels: Object.freeze({
    PASS: Object.freeze({ en: 'Financial Analysis Passed', ar: 'اجتاز التحليل المالي' }),
    ATTRACTIVE: Object.freeze({ en: 'Financially Attractive', ar: 'مجدي ماليًا' }),
    FAIL: Object.freeze({ en: 'Financial Analysis Failed', ar: 'لم يجتز التحليل المالي' }),
    UNATTRACTIVE: Object.freeze({ en: 'Financially Unattractive', ar: 'غير مجدٍ ماليًا' }),
  }),
  scopeNotice: FINANCIAL_SCOPE_NOTICE,
});

function getRecommendationMethodologyMetadata() {
  return recommendationMethodologyMetadata;
}

module.exports = { FINANCIAL_SCOPE_NOTICE, recommendationMethodologyMetadata, getRecommendationMethodologyMetadata };
