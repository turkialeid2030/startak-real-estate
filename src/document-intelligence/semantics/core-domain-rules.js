'use strict';

// Definitions only. Registration, freezing, and default materiality are applied by registry.js.
// These rules are project-name independent and rely on explicit field labels.
const CORE_DOMAIN_RULE_DEFINITIONS = [
  { id: 'IDENTITY_PROPERTY_REFERENCE', key: 'identity.property_reference', valueType: 'STRING', unit: null, normalization: 'STRING', aliases: ['معرف العقار', 'رقم العقار', 'مرجع العقار', 'property id', 'property reference'] },
  { id: 'IDENTITY_PROJECT_REFERENCE', key: 'identity.project_reference', valueType: 'STRING', unit: null, normalization: 'STRING', aliases: ['معرف المشروع', 'رقم المشروع', 'مرجع المشروع', 'project id', 'project reference'] },

  { id: 'LOCATION_CITY', key: 'location.city', valueType: 'STRING', unit: null, normalization: 'STRING', aliases: ['المدينة', 'مدينه', 'city'] },
  { id: 'LOCATION_DISTRICT', key: 'location.district', valueType: 'STRING', unit: null, normalization: 'STRING', aliases: ['الحي', 'اسم الحي', 'district', 'neighborhood'] },
  { id: 'LOCATION_ADDRESS', key: 'location.address', valueType: 'STRING', unit: null, normalization: 'STRING', aliases: ['العنوان', 'عنوان العقار', 'الموقع التفصيلي', 'address', 'property address'] },
  { id: 'LOCATION_LATITUDE', key: 'location.latitude', valueType: 'NUMBER', unit: 'degree', normalization: 'NUMBER', aliases: ['خط العرض', 'latitude'], numericTolerance: { absolute: 0.000001 } },
  { id: 'LOCATION_LONGITUDE', key: 'location.longitude', valueType: 'NUMBER', unit: 'degree', normalization: 'NUMBER', aliases: ['خط الطول', 'longitude'], numericTolerance: { absolute: 0.000001 } },

  { id: 'OWNERSHIP_TITLE_DEED_NUMBER', key: 'ownership.title_deed_number', valueType: 'STRING', unit: null, normalization: 'STRING', aliases: ['رقم الصك', 'رقم صك الملكية', 'title deed number', 'deed number'] },
  { id: 'OWNERSHIP_OWNER_NAME', key: 'ownership.owner_name', valueType: 'STRING', unit: null, normalization: 'STRING', aliases: ['اسم المالك', 'المالك', 'owner name', 'registered owner'] },
  { id: 'RIGHTS_TENURE_TYPE', key: 'rights.tenure_type', valueType: 'STRING', unit: null, normalization: 'STRING', aliases: ['نوع الملكية', 'نوع الحيازة', 'صفة التملك', 'tenure type', 'ownership type'] },
  { id: 'RIGHTS_ENCUMBRANCE_STATUS', key: 'rights.encumbrance_status', valueType: 'STRING', unit: null, normalization: 'STRING', aliases: ['حالة الرهن', 'الرهون والقيود', 'القيود على العقار', 'encumbrance status', 'mortgage status'] },

  { id: 'REGULATORY_LAND_USE', key: 'regulatory.land_use', valueType: 'STRING', unit: null, normalization: 'STRING', aliases: ['استخدام الأرض', 'الاستخدام المعتمد', 'الاستعمال', 'land use', 'permitted use'] },
  { id: 'REGULATORY_ZONING_CODE', key: 'regulatory.zoning_code', valueType: 'STRING', unit: null, normalization: 'STRING', aliases: ['كود المنطقة', 'رمز التنظيم', 'التصنيف التنظيمي', 'zoning code', 'zoning classification'] },
  { id: 'REGULATORY_BUILDING_PERMIT_NUMBER', key: 'regulatory.building_permit_number', valueType: 'STRING', unit: null, normalization: 'STRING', aliases: ['رقم رخصة البناء', 'رخصة البناء رقم', 'building permit number', 'building license number'] },
  { id: 'REGULATORY_ALLOWED_FLOORS', key: 'regulatory.allowed_floors', valueType: 'NUMBER', unit: 'floor', normalization: 'NUMBER', aliases: ['عدد الأدوار المسموحة', 'الأدوار المسموحة', 'allowed floors', 'permitted floors'], numericTolerance: { absolute: 0 } },

  { id: 'RISK_FLOOD_STATUS', key: 'risk.flood_status', valueType: 'STRING', unit: null, normalization: 'STRING', aliases: ['حالة مخاطر السيول', 'مخاطر السيول', 'flood risk status', 'flood zone status'] },
  { id: 'RISK_STRUCTURAL_CONDITION', key: 'risk.structural_condition', valueType: 'STRING', unit: null, normalization: 'STRING', aliases: ['الحالة الإنشائية', 'حالة المبنى الإنشائية', 'structural condition'] },
  { id: 'RISK_ENVIRONMENTAL_STATUS', key: 'risk.environmental_status', valueType: 'STRING', unit: null, normalization: 'STRING', aliases: ['الحالة البيئية', 'مخاطر بيئية', 'environmental status', 'environmental risk status'] },

  { id: 'OPERATIONS_GROSS_OPERATING_PROFIT', key: 'operations.gross_operating_profit', valueType: 'NUMBER', unit: 'SAR/year', normalization: 'NUMBER', aliases: ['إجمالي الربح التشغيلي', 'الربح التشغيلي الإجمالي', 'gross operating profit', 'GOP'], numericTolerance: { absolute: 1, relative: 0.000001 } },
  { id: 'OPERATIONS_ROOM_COUNT', key: 'operations.room_count', valueType: 'NUMBER', unit: 'room', normalization: 'NUMBER', aliases: ['عدد الغرف', 'إجمالي عدد الغرف', 'room count', 'number of rooms'], numericTolerance: { absolute: 0 } },
  { id: 'OPERATIONS_UNIT_COUNT', key: 'operations.unit_count', valueType: 'NUMBER', unit: 'unit', normalization: 'NUMBER', aliases: ['عدد الوحدات', 'إجمالي عدد الوحدات', 'unit count', 'number of units'], numericTolerance: { absolute: 0 } },
  { id: 'OPERATIONS_ADR', key: 'operations.adr', valueType: 'NUMBER', unit: 'SAR/room-night', normalization: 'NUMBER', aliases: ['متوسط سعر الغرفة', 'متوسط السعر اليومي', 'average daily rate', 'ADR'], numericTolerance: { absolute: 1 } },
  { id: 'OPERATIONS_REVPAR', key: 'operations.revpar', valueType: 'NUMBER', unit: 'SAR/available-room-night', normalization: 'NUMBER', aliases: ['الإيراد لكل غرفة متاحة', 'RevPAR', 'revenue per available room'], numericTolerance: { absolute: 1 } },

  { id: 'FINANCING_LOAN_AMOUNT', key: 'financing.loan_amount', valueType: 'NUMBER', unit: 'SAR', normalization: 'NUMBER', aliases: ['مبلغ التمويل', 'قيمة التمويل', 'loan amount', 'financing amount'], numericTolerance: { absolute: 1, relative: 0.000001 } },
  { id: 'FINANCING_LTV', key: 'financing.ltv', valueType: 'NUMBER', unit: 'ratio', normalization: 'PERCENT_RATIO', aliases: ['نسبة التمويل إلى القيمة', 'نسبة القرض إلى القيمة', 'LTV', 'loan to value'], numericTolerance: { absolute: 0.0002 } },
  { id: 'FINANCING_INTEREST_RATE', key: 'financing.interest_rate', valueType: 'NUMBER', unit: 'ratio', normalization: 'PERCENT_RATIO', aliases: ['معدل الفائدة', 'نسبة الفائدة', 'interest rate', 'financing rate'], numericTolerance: { absolute: 0.0002 } },

  { id: 'CAPEX_TOTAL', key: 'capex.total', valueType: 'NUMBER', unit: 'SAR', normalization: 'NUMBER', aliases: ['إجمالي النفقات الرأسمالية', 'إجمالي الكابكس', 'إجمالي تكلفة التطوير', 'total capex', 'total development cost'], numericTolerance: { absolute: 1, relative: 0.000001 } },
  { id: 'CAPEX_CONSTRUCTION_COST', key: 'capex.construction_cost', valueType: 'NUMBER', unit: 'SAR', normalization: 'NUMBER', aliases: ['تكلفة الإنشاء', 'تكلفة البناء', 'construction cost'], numericTolerance: { absolute: 1, relative: 0.000001 } },
  { id: 'CAPEX_CONTINGENCY_RATE', key: 'capex.contingency_rate', valueType: 'NUMBER', unit: 'ratio', normalization: 'PERCENT_RATIO', aliases: ['نسبة الاحتياطي', 'احتياطي الطوارئ', 'contingency rate', 'contingency percentage'], numericTolerance: { absolute: 0.0002 } },

  { id: 'SCHEDULE_DEVELOPMENT_MONTHS', key: 'schedule.development_months', valueType: 'NUMBER', unit: 'month', normalization: 'NUMBER', aliases: ['مدة التطوير بالأشهر', 'مدة التنفيذ بالأشهر', 'development duration months', 'construction duration months'], numericTolerance: { absolute: 0 } },

  { id: 'TAX_RETT_RATE', key: 'tax.rett_rate', valueType: 'NUMBER', unit: 'ratio', normalization: 'PERCENT_RATIO', aliases: ['نسبة ضريبة التصرفات العقارية', 'ضريبة التصرفات العقارية', 'RETT rate', 'real estate transaction tax rate'], numericTolerance: { absolute: 0.0002 } },
  { id: 'TAX_VAT_RATE', key: 'tax.vat_rate', valueType: 'NUMBER', unit: 'ratio', normalization: 'PERCENT_RATIO', aliases: ['نسبة ضريبة القيمة المضافة', 'ضريبة القيمة المضافة', 'VAT rate'], numericTolerance: { absolute: 0.0002 } },

  { id: 'EXIT_CAP_RATE', key: 'exit.cap_rate', valueType: 'NUMBER', unit: 'ratio', normalization: 'PERCENT_RATIO', aliases: ['معدل رسملة الخروج', 'معدل الرسملة عند البيع', 'exit cap rate', 'terminal cap rate'], numericTolerance: { absolute: 0.0002 } },
  { id: 'EXIT_VALUE', key: 'exit.value', valueType: 'NUMBER', unit: 'SAR', normalization: 'NUMBER', aliases: ['قيمة الخروج', 'قيمة البيع المتوقعة', 'exit value', 'terminal value'], numericTolerance: { absolute: 1, relative: 0.000001 } },

  { id: 'ESG_ENVIRONMENTAL_CERTIFICATION', key: 'esg.environmental_certification', valueType: 'STRING', unit: null, normalization: 'STRING', aliases: ['الشهادة البيئية', 'شهادة الاستدامة', 'environmental certification', 'sustainability certification'] },
];

module.exports = { CORE_DOMAIN_RULE_DEFINITIONS };
