'use strict';

// Decision-critical semantic overrides.
//
// The base locale dictionaries preserve the historical UI wording for source
// traceability. These overrides narrow labels whose broader wording could imply
// a stronger financial conclusion than the engine actually computes.
const DECISION_METRIC_LABEL_OVERRIDES = Object.freeze({
  'ar-SA': Object.freeze({
    'metricRowR2B2.maxJustifiedPrice': 'أقصى سعر شراء للمبنى وفق حدّي العائد الصافي والاسترداد فقط',
    'metricRowR2B2.maxJustifiedLandPricePerSqm': 'أقصى سعر لمتر الأرض وفق حد الاسترداد فقط',
  }),
  en: Object.freeze({
    'metricRowR2B2.maxJustifiedPrice': 'Maximum Building Purchase Price — Yield/Payback Thresholds Only',
    'metricRowR2B2.maxJustifiedLandPricePerSqm': 'Maximum Land Price per Sqm — Payback Threshold Only',
  }),
});

function getDecisionMetricLabelOverride(locale, path) {
  const localeOverrides = DECISION_METRIC_LABEL_OVERRIDES[locale];
  if (!localeOverrides) return null;
  return Object.prototype.hasOwnProperty.call(localeOverrides, path)
    ? localeOverrides[path]
    : null;
}

module.exports = {
  DECISION_METRIC_LABEL_OVERRIDES,
  getDecisionMetricLabelOverride,
};
