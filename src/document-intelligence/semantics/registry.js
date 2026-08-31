'use strict';

const { MATERIALITY, deepFreeze } = require('../contracts');
const { CORE_DOMAIN_RULE_DEFINITIONS } = require('./core-domain-rules');

const NORMALIZATION = Object.freeze({
  NUMBER: 'NUMBER',
  PERCENT_RATIO: 'PERCENT_RATIO',
  STRING: 'STRING',
});

function rule(definition) {
  return deepFreeze({
    materiality: MATERIALITY.SUPPORTING,
    numericTolerance: {},
    ...definition,
    aliases: [...definition.aliases],
  });
}

const SEMANTIC_RULES = deepFreeze([
  rule({ id: 'PROPERTY_LAND_AREA', key: 'property.land_area', valueType: 'NUMBER', unit: 'm2', normalization: NORMALIZATION.NUMBER, materiality: MATERIALITY.MATERIAL, aliases: ['إجمالي مساحة الأرض', 'المساحة الإجمالية للأرض', 'مساحة الأرض'], numericTolerance: { absolute: 0.5 } }),
  rule({ id: 'LETTABLE_AREA', key: 'leasing.lettable_area', valueType: 'NUMBER', unit: 'm2', normalization: NORMALIZATION.NUMBER, materiality: MATERIALITY.MATERIAL, aliases: ['إجمالي المساحة التأجيرية الصافية', 'المساحة التأجيرية المعتمدة', 'المساحة التأجيرية'], numericTolerance: { absolute: 0.5 } }),
  rule({ id: 'PURCHASE_PRICE', key: 'transaction.purchase_price', valueType: 'NUMBER', unit: 'SAR', normalization: NORMALIZATION.NUMBER, materiality: MATERIALITY.MATERIAL, aliases: ['قيمة شراء المبنى', 'سعر شراء المبنى', 'قيمة شراء العقار', 'سعر شراء العقار'], numericTolerance: { absolute: 1, relative: 0.000001 } }),
  rule({ id: 'LAND_PURCHASE_PRICE', key: 'transaction.purchase_price', valueType: 'NUMBER', unit: 'SAR', normalization: NORMALIZATION.NUMBER, materiality: MATERIALITY.MATERIAL, aliases: ['قيمة شراء الأرض', 'سعر شراء الأرض'], numericTolerance: { absolute: 1, relative: 0.000001 } }),
  rule({ id: 'TOTAL_ACQUISITION_COST', key: 'transaction.total_acquisition_cost', valueType: 'NUMBER', unit: 'SAR', normalization: NORMALIZATION.NUMBER, materiality: MATERIALITY.MATERIAL, aliases: ['إجمالي تكلفة شراء المبنى', 'إجمالي تكلفة الاستحواذ', 'تكلفة الاستحواذ', 'إجمالي تكلفة الشراء'], numericTolerance: { absolute: 1, relative: 0.000001 } }),
  rule({ id: 'LAND_MARKET_VALUE', key: 'market.land_value', valueType: 'NUMBER', unit: 'SAR', normalization: NORMALIZATION.NUMBER, materiality: MATERIALITY.MATERIAL, aliases: ['القيمة السوقية للأرض'], numericTolerance: { absolute: 1, relative: 0.000001 } }),
  rule({ id: 'PROPERTY_MARKET_VALUE', key: 'market.property_value', valueType: 'NUMBER', unit: 'SAR', normalization: NORMALIZATION.NUMBER, materiality: MATERIALITY.MATERIAL, aliases: ['القيمة السوقية للعقار', 'القيمة السوقية بالرسملة', 'القيمة السوقية بطريقة رسملة الدخل'], numericTolerance: { absolute: 1, relative: 0.000001 } }),
  rule({ id: 'NOI_ANNUAL', key: 'financial.noi_annual', valueType: 'NUMBER', unit: 'SAR/year', normalization: NORMALIZATION.NUMBER, materiality: MATERIALITY.MATERIAL, aliases: ['صافي الدخل التشغيلي السنوي (NOI)', 'صافي الدخل التشغيلي (NOI)', 'صافي الدخل التشغيلي'], numericTolerance: { absolute: 1, relative: 0.000001 } }),
  rule({ id: 'IRR', key: 'financial.irr', valueType: 'NUMBER', unit: 'ratio', normalization: NORMALIZATION.PERCENT_RATIO, materiality: MATERIALITY.MATERIAL, aliases: ['معدل العائد الداخلي (IRR)', 'معدل العائد الداخلي'], numericTolerance: { absolute: 0.0002 } }),
  rule({ id: 'RETURN_ON_COST', key: 'financial.return_on_cost', valueType: 'NUMBER', unit: 'ratio', normalization: NORMALIZATION.PERCENT_RATIO, materiality: MATERIALITY.MATERIAL, aliases: ['العائد على التكلفة (Cap Rate)', 'العائد على التكلفة'], numericTolerance: { absolute: 0.0002 } }),
  rule({ id: 'MARKET_CAP_RATE', key: 'market.cap_rate', valueType: 'NUMBER', unit: 'ratio', normalization: NORMALIZATION.PERCENT_RATIO, aliases: ['معدل الرسملة السوقي (Cap Rate)', 'معدل الرسملة السوقي', 'معدل الرسملة'], numericTolerance: { absolute: 0.0002 } }),
  rule({ id: 'NET_YIELD_PURCHASE_PRICE', key: 'financial.net_yield_on_purchase_price', valueType: 'NUMBER', unit: 'ratio', normalization: NORMALIZATION.PERCENT_RATIO, aliases: ['العائد السنوي الصافي على قيمة الشراء'], numericTolerance: { absolute: 0.0002 } }),
  rule({ id: 'PAYBACK_YEARS', key: 'financial.payback_years', valueType: 'NUMBER', unit: 'year', normalization: NORMALIZATION.NUMBER, materiality: MATERIALITY.MATERIAL, aliases: ['فترة استرداد رأس المال', 'عدد سنوات استرداد رأس المال', 'سنوات الاسترداد على قيمة الشراء'], numericTolerance: { absolute: 0.05 } }),
  rule({ id: 'OCCUPANCY_RATE', key: 'leasing.occupancy_rate', valueType: 'NUMBER', unit: 'ratio', normalization: NORMALIZATION.PERCENT_RATIO, aliases: ['نسبة الإشغال المتوقعة', 'نسبة الإشغال'], numericTolerance: { absolute: 0.0002 } }),
  rule({ id: 'RENT_PER_SQM_YEAR', key: 'leasing.rent_per_sqm_year', valueType: 'NUMBER', unit: 'SAR/m2/year', normalization: NORMALIZATION.NUMBER, aliases: ['سعر المتر التأجيري', 'سعر الإيجار للمتر المربع'], numericTolerance: { absolute: 1 } }),
  rule({ id: 'LAND_PRICE_PER_SQM', key: 'market.land_price_per_sqm', valueType: 'NUMBER', unit: 'SAR/m2', normalization: NORMALIZATION.NUMBER, aliases: ['سعر المتر المربع (سعر السوق)', 'سعر متر الأرض الحالي', 'سعر المتر السوقي للأرض'], numericTolerance: { absolute: 1 } }),
  rule({ id: 'BUILDABLE_RATIO', key: 'development.buildable_ratio', valueType: 'NUMBER', unit: 'ratio', normalization: NORMALIZATION.PERCENT_RATIO, aliases: ['نسبة البناء المسموحة', 'نسبة البناء'], numericTolerance: { absolute: 0.0002 } }),
  rule({ id: 'DISCOUNT_RATE', key: 'financial.discount_rate', valueType: 'NUMBER', unit: 'ratio', normalization: NORMALIZATION.PERCENT_RATIO, aliases: ['معدل الخصم (لحساب NPV)', 'معدل الخصم'], numericTolerance: { absolute: 0.0002 } }),
  rule({ id: 'INVESTMENT_HORIZON', key: 'financial.investment_horizon_years', valueType: 'NUMBER', unit: 'year', normalization: NORMALIZATION.NUMBER, aliases: ['مدة الاستثمار (سنة البيع)', 'مدة الاستثمار'], numericTolerance: { absolute: 0 } }),
  rule({ id: 'BUILDING_AGE', key: 'property.building_age_years', valueType: 'NUMBER', unit: 'year', normalization: NORMALIZATION.NUMBER, aliases: ['عمر المبنى الحالي', 'عمر المبنى'], numericTolerance: { absolute: 0 } }),
  ...CORE_DOMAIN_RULE_DEFINITIONS.map(rule),
]);

const RULE_BY_ID = new Map(SEMANTIC_RULES.map((item) => [item.id, item]));

function semanticRuleById(id) { return RULE_BY_ID.get(id) || null; }
function semanticKeys() { return [...new Set(SEMANTIC_RULES.map((item) => item.key))]; }
function numericToleranceByKey() {
  const result = {};
  for (const item of SEMANTIC_RULES) {
    result[item.key] = { ...(result[item.key] || {}), ...item.numericTolerance };
  }
  return result;
}

module.exports = { NORMALIZATION, SEMANTIC_RULES, semanticRuleById, semanticKeys, numericToleranceByKey };
