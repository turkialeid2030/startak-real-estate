'use strict';

// Decision-critical semantic overrides.
//
// The base locale dictionaries preserve historical wording for source
// traceability. These overrides narrow labels or legal/regulatory notes whose
// broader wording could imply a stronger financial or regulatory conclusion
// than the supported evidence.
const RIYADH_RENT_CONTROL_EVIDENCE = Object.freeze({
  authority: 'GENERAL_REAL_ESTATE_AUTHORITY_REGA',
  sourceTitle: 'الأحكام النظامية الخاصة بضبط العلاقة بين المؤجر والمستأجر',
  reviewedOn: '2026-09-27',
  effectiveDate: '2025-09-25',
  coreRestrictionYears: 5,
  geography: 'RIYADH_CITY',
  appliesToExistingContractsAtEffectiveDate: true,
  appliesToContractsConcludedAfterEffectiveDate: true,
  firstRentForNeverPreviouslyLeasedPropertySetByAgreement: true,
  runtimeApplicabilityEngineComplete: false,
});

const DECISION_METRIC_LABEL_OVERRIDES = Object.freeze({
  'ar-SA': Object.freeze({
    'metricRowR2B2.maxJustifiedPrice': 'أقصى سعر شراء للمبنى وفق حدّي العائد الصافي والاسترداد فقط',
    'metricRowR2B2.maxJustifiedLandPricePerSqm': 'أقصى سعر لمتر الأرض وفق حد الاسترداد فقط',
    'inputBuilding.rentFreezeChecked': 'التحقق من انطباق أحكام ضبط الأجرة على العقار والعقد',
    'inputBuilding.rentFreezeCheckedNote': 'في مدينة الرياض، تسري أحكام ضبط الأجرة على العقود القائمة عند النفاذ والعقود التي تُبرم بعده لمدة خمس سنوات بدءًا من 25 سبتمبر 2025. إذا كان العقار لم يسبق تأجيره فتحدد الأجرة الإجمالية الأولى بالاتفاق؛ ولا يعني ذلك إعفاء الزيادات اللاحقة. يجب التحقق من الموقع وتاريخ العقد وسجل التأجير وأي حالة اعتراض أو استثناء معتمدة قبل افتراض نمو الإيجار.',
    'dashboardR3.regRentFreezeConfirmed': 'التحقق من انطباق أحكام ضبط الأجرة على العقار والعقد',
    'dashboardR3.regRentFreezeNote': 'تشمل أحكام ضبط الأجرة في مدينة الرياض العقود القائمة عند النفاذ والعقود التي تُبرم بعده. للعقار الذي لم يسبق تأجيره تُحدد الأجرة الأولى بالاتفاق، مع بقاء الانطباق اللاحق بحاجة إلى تحقق مؤرخ من الوقائع والأحكام السارية.',
  }),
  en: Object.freeze({
    'metricRowR2B2.maxJustifiedPrice': 'Maximum Building Purchase Price — Yield/Payback Thresholds Only',
    'metricRowR2B2.maxJustifiedLandPricePerSqm': 'Maximum Land Price per Sqm — Payback Threshold Only',
    'inputBuilding.rentFreezeChecked': 'Verify applicability of Riyadh rent-control rules to the property and lease',
    'inputBuilding.rentFreezeCheckedNote': 'Within Riyadh city, the rent-control provisions apply to leases existing at effectiveness and leases concluded afterwards for the five-year statutory period beginning 25 September 2025. For a property never previously leased, the first aggregate rent is agreed by the parties; this does not mean later increases are exempt. Verify location, lease date, leasing history, and any approved objection or exception before assuming rent growth.',
    'dashboardR3.regRentFreezeConfirmed': 'Rent-control applicability verified for the property and lease',
    'dashboardR3.regRentFreezeNote': 'Riyadh rent-control provisions cover leases existing at effectiveness and leases concluded afterwards. First rent for a property never previously leased is agreed by the parties; subsequent applicability still requires dated verification of the facts and rules in force.',
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
  RIYADH_RENT_CONTROL_EVIDENCE,
  DECISION_METRIC_LABEL_OVERRIDES,
  getDecisionMetricLabelOverride,
};
