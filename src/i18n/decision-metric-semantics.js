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

const SAUDI_RETT_EVIDENCE = Object.freeze({
  authority: 'ZATCA_AND_UMM_AL_QURA',
  reviewedOn: '2026-09-27',
  royalDecree: 'M/84_19-03-1446H',
  effectiveDate: '2025-04-10',
  statutoryRate: 0.05,
  taxBase: 'TOTAL_AGREED_DISPOSITION_VALUE_SUBJECT_TO_FAIR_MARKET_VALUE_RULES',
  statutoryResponsibleParty: 'DISPOSER_TRANSFEROR',
  transfereeJointLiability: 'ONLY_WHERE_ZATCA_ESTABLISHES_TRANSFEREE_CAUSED_NONPAYMENT',
  exemptionsExist: true,
  economicIncidenceRequiresDealEvidence: true,
  runtimeApplicabilityEngineComplete: false,
  sources: Object.freeze([
    'https://zatca.gov.sa/ar/RulesRegulations/Taxes/Pages/RETTRegulation.aspx',
    'https://www.uqn.gov.sa/details?p=26600',
    'https://zatca.gov.sa/ar/RulesRegulations/Taxes/Pages/New-RETT.aspx',
  ]),
});

// P21 / #401: the legacy `coverageRatio` metric is total built area divided by
// land area. Because total built area includes every floor and basements, it is
// a gross built-area multiple. It is not conventional site/footprint coverage
// and it is not a zoning/FAR-compliance determination.
const GROSS_BUILT_AREA_RATIO_SEMANTICS = Object.freeze({
  legacyField: 'coverageRatio',
  numerator: 'TOTAL_BUILT_AREA_INCLUDING_BASEMENTS',
  denominator: 'LAND_AREA',
  formula: 'TOTAL_BUILT_AREA_INCLUDING_BASEMENTS / LAND_AREA',
  includesBasements: true,
  isSiteCoverageRatio: false,
  isZoningComplianceMetric: false,
});

const DECISION_METRIC_LABEL_OVERRIDES = Object.freeze({
  'ar-SA': Object.freeze({
    'metricRowR2B2.maxJustifiedPrice': 'أقصى سعر شراء للمبنى وفق حدّي العائد الصافي والاسترداد فقط',
    'metricRowR2B2.maxJustifiedLandPricePerSqm': 'أقصى سعر لمتر الأرض وفق حد الاسترداد فقط',
    'metricRow.coverageRatio': 'مضاعف إجمالي المساحة المبنية إلى مساحة الأرض — يشمل الأقبية وليس نسبة تغطية الموقع',
    'financingInput.ltvLabelBuilding': 'نسبة التمويل المطلوبة إلى إجمالي تكلفة الاستحواذ (LTC)',
    'financingInput.ltvWarnBuilding': 'النسبة في هذا المسار تُطبّق على إجمالي تكلفة الاستحواذ، وليست نسبة قرض إلى سعر الشراء أو إلى قيمة تقييم مستقلة',
    'metricRowR2B3.loanAmountBuilding': 'مبلغ التمويل الفعلي بعد قيود التكلفة وتغطية خدمة الدين',
    'inputBuilding.transferFeeRate': 'افتراض نسبة تكلفة التصرف المستخدمة عند الاستحواذ والخروج — سيناريو اقتصادي',
    'inputLand.landTransferFeeRate': 'افتراض نسبة تكلفة التصرف المحمّلة اقتصاديًا على المشتري عند الاستحواذ',
    'inputLand.exitTransferFeeRate': 'افتراض نسبة تكلفة الخروج المحمّلة اقتصاديًا على البائع',
    'inputLand.exitTransferFeeRateNote': 'هذا إدخال اقتصادي لنموذج الخروج وليس تحديدًا تلقائيًا للمكلّف نظامًا. نظام ضريبة التصرفات العقارية الحالي يفرض 5% كقاعدة عامة ويجعل المتصرف مسؤولًا عن الضريبة المستحقة، مع وجود إعفاءات وحالات مسؤولية تضامنية. تحقّق من انطباق الضريبة والعقد والطرف المتحمل اقتصاديًا قبل اعتماد النتيجة.',
    'inputBuilding.rentFreezeChecked': 'التحقق من انطباق أحكام ضبط الأجرة على العقار والعقد',
    'inputBuilding.rentFreezeCheckedNote': 'في مدينة الرياض، تسري أحكام ضبط الأجرة على العقود القائمة عند النفاذ والعقود التي تُبرم بعده لمدة خمس سنوات بدءًا من 25 سبتمبر 2025. إذا كان العقار لم يسبق تأجيره فتحدد الأجرة الإجمالية الأولى بالاتفاق؛ ولا يعني ذلك إعفاء الزيادات اللاحقة. يجب التحقق من الموقع وتاريخ العقد وسجل التأجير وأي حالة اعتراض أو استثناء معتمدة قبل افتراض نمو الإيجار.',
    'dashboardR3.regRentFreezeConfirmed': 'التحقق من انطباق أحكام ضبط الأجرة على العقار والعقد',
    'dashboardR3.regRentFreezeNote': 'تشمل أحكام ضبط الأجرة في مدينة الرياض العقود القائمة عند النفاذ والعقود التي تُبرم بعده. للعقار الذي لم يسبق تأجيره تُحدد الأجرة الأولى بالاتفاق، مع بقاء الانطباق اللاحق بحاجة إلى تحقق مؤرخ من الوقائع والأحكام السارية.',
  }),
  en: Object.freeze({
    'metricRowR2B2.maxJustifiedPrice': 'Maximum Building Purchase Price — Yield/Payback Thresholds Only',
    'metricRowR2B2.maxJustifiedLandPricePerSqm': 'Maximum Land Price per Sqm — Payback Threshold Only',
    'metricRow.coverageRatio': 'Gross Built Area / Land Area Multiple — includes basements; not site coverage',
    'financingInput.ltvLabelBuilding': 'Requested Loan-to-Total-Acquisition-Cost Ratio (LTC)',
    'financingInput.ltvWarnBuilding': 'This ratio is applied to total acquisition cost, not raw purchase price and not an independently appraised value.',
    'metricRowR2B3.loanAmountBuilding': 'Actual Debt Amount after Cost and DSCR Constraints',
    'inputBuilding.transferFeeRate': 'Transaction-Cost Rate Assumption Used at Acquisition and Exit — Economic Scenario',
    'inputLand.landTransferFeeRate': 'Buyer-Borne Acquisition Transaction-Cost Rate Assumption',
    'inputLand.exitTransferFeeRate': 'Seller-Borne Exit Transaction-Cost Rate Assumption',
    'inputLand.exitTransferFeeRateNote': 'This is an economic exit-model input, not an automatic statement of the statutory taxpayer. The current Saudi RETT system generally applies a 5% rate and makes the disposer/transferor responsible for the tax due, subject to exemptions and specified joint-liability cases. Verify applicability, contract terms, and economic incidence before relying on the result.',
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
  SAUDI_RETT_EVIDENCE,
  GROSS_BUILT_AREA_RATIO_SEMANTICS,
  DECISION_METRIC_LABEL_OVERRIDES,
  getDecisionMetricLabelOverride,
};
