'use strict';

// Presentation-only Arabic localization boundary. Engine/domain values remain
// byte-identical; this module converts only customer-facing labels/statuses.
const ARABIC_VALUE_LABELS = Object.freeze({
  // Generic workflow / readiness states
  READY_FOR_REVIEW: 'جاهز للمراجعة',
  READY: 'جاهز',
  PASS: 'ناجح',
  PASSED: 'ناجح',
  FAIL: 'فشل',
  FAILED: 'فشل',
  PENDING: 'قيد الانتظار',
  BLOCKED: 'محظور',
  HOLD: 'معلّق',
  HOLD_STUDY: 'الدراسة معلّقة',
  HOLD_EVIDENCE: 'معلّق لاستكمال الأدلة',
  HOLD_AI_OUTPUTS: 'معلّق لاستكمال مخرجات الذكاء الاصطناعي',
  MISSING_REQUIRED: 'متطلبات إلزامية ناقصة',
  NOT_STARTED: 'لم يبدأ',
  IN_PROGRESS: 'قيد التنفيذ',
  COMPLETE: 'مكتمل',
  COMPLETED: 'مكتمل',
  CLOSED: 'مغلق',
  OPEN: 'مفتوح',
  UNKNOWN: 'غير معروف',
  UNAVAILABLE: 'غير متاح',
  NOT_AVAILABLE: 'غير متاح',
  VERIFIED: 'متحقق منه',
  UNVERIFIED: 'غير متحقق منه',
  APPROVED: 'معتمد',
  REJECTED: 'مرفوض',
  ACCEPTED: 'مقبول',
  DRAFT: 'مسودة',
  ACTIVE: 'نشط',
  INACTIVE: 'غير نشط',
  REQUIRED: 'مطلوب',
  OPTIONAL: 'اختياري',

  // Canonical / committee / post-decision workflow states
  RECORDED_HUMAN_DECISION: 'قرار بشري مسجل',
  WAITING_FOR_HUMAN_COMMITTEE_DECISION: 'بانتظار قرار اللجنة البشري',
  ACTION_REVIEW_CLOSED: 'مراجعة الإجراءات مغلقة',
  ACTION_REVIEW_OPEN: 'مراجعة الإجراءات مفتوحة',
  VERIFIED_FACT_RECORDED_NOT_UNDERWRITING_READY: 'تم تسجيل حقيقة متحقق منها — غير جاهزة للاكتتاب',
  VERIFICATION_NOT_COMPLETE: 'التحقق غير مكتمل',
  READY_FOR_HUMAN_REVIEW: 'جاهز للمراجعة البشرية',
  READY_FOR_HUMAN_COMMITTEE: 'جاهز لتحضير اللجنة البشرية',
  WAITING_FOR_EVIDENCE: 'بانتظار الأدلة',
  WAITING_FOR_REVIEW: 'بانتظار المراجعة',
  WAITING_FOR_APPROVAL: 'بانتظار الاعتماد',

  // AI roles
  ANALYST: 'المحلل',
  CHALLENGER: 'المراجع الناقد',
  SYNTHESIZER: 'المحلل التركيبي',

  // Main study modes
  building: 'مبنى قائم',
  land: 'أرض وتطوير',
  BUILDING: 'مبنى قائم',
  LAND_DEVELOPMENT: 'أرض وتطوير',

  // Project model — asset classes
  LAND: 'أرض',
  RESIDENTIAL: 'سكني',
  OFFICE: 'مكاتب',
  RETAIL: 'تجزئة',
  INDUSTRIAL_LOGISTICS: 'صناعي ولوجستي',
  HOSPITALITY: 'ضيافة',
  HEALTHCARE: 'رعاية صحية',
  EDUCATION: 'تعليمي',
  MIXED_USE: 'استخدام مختلط',
  PARKING: 'مواقف سيارات',
  DATA_CENTER: 'مركز بيانات',
  SPECIAL_PURPOSE: 'استخدام خاص',
  OTHER: 'أخرى',

  // Project model — lifecycle
  VACANT: 'شاغر',
  PLANNED: 'مخطط',
  UNDER_DEVELOPMENT: 'قيد التطوير',
  EXISTING_VACANT: 'قائم وشاغر',
  EXISTING_OPERATING: 'قائم وتشغيلي',
  STABILIZED: 'مستقر تشغيليًا',
  REDEVELOPMENT: 'إعادة تطوير',
  RENOVATION: 'تجديد',
  CONVERSION: 'تحويل استخدام',
  PORTFOLIO: 'محفظة',

  // Project model — strategy
  ACQUIRE_HOLD: 'استحواذ واحتفاظ',
  CORE_INCOME: 'دخل أساسي مستقر',
  DEVELOPMENT: 'تطوير',
  VALUE_ADD: 'إضافة قيمة',
  LEASE: 'تأجير',
  DISPOSAL: 'تخارج',
  REFINANCE: 'إعادة تمويل',
  JOINT_VENTURE: 'مشروع مشترك',
  SALE_LEASEBACK: 'بيع وإعادة استئجار',

  // Project model — income model
  NONE: 'دون دخل',
  LEASE_INCOME: 'دخل إيجاري',
  OPERATING_BUSINESS: 'نشاط تشغيلي',
  UNIT_SALES: 'مبيعات وحدات',
  MIXED: 'مختلط',

  // Evidence / action vocabulary
  MATERIAL: 'جوهري',
  NON_MATERIAL: 'غير جوهري',
  HIGH: 'مرتفع',
  MEDIUM: 'متوسط',
  LOW: 'منخفض',
  CRITICAL: 'حرج',
  POSITIVE: 'إيجابي',
  NEGATIVE: 'سلبي',
  NEUTRAL: 'محايد',
});

// Long/specific phrases must precede their shorter component acronyms.
const ARABIC_TERM_REPLACEMENTS = Object.freeze([
  [/\bExit Cap Rate\b/gi, 'معدل رسملة التخارج'],
  [/\bHurdle Rate\b/gi, 'معدل العائد المستهدف'],
  [/\bYield on Cost\b/gi, 'العائد على التكلفة'],
  [/\bRent Roll\b/gi, 'سجل الإيجارات'],
  [/\bCap Rate\b/gi, 'معدل الرسملة'],
  [/\bYear[- ]?1\b/gi, 'السنة الأولى'],
  [/\bSTARTAK\b/gi, 'ستارتاك'],
  [/\bStartak\b/g, 'ستارتاك'],
  [/\bMIRR\b/g, 'معدل العائد الداخلي المعدل'],
  [/\bIRR\b/g, 'معدل العائد الداخلي'],
  [/\bNPV\b/g, 'صافي القيمة الحالية'],
  [/\bNOI\b/g, 'صافي الدخل التشغيلي'],
  [/\bDSCR\b/g, 'نسبة تغطية خدمة الدين'],
  [/\bLTV\b/g, 'نسبة التمويل إلى القيمة'],
  [/\bLTC\b/g, 'نسبة التمويل إلى التكلفة'],
  [/\bOPEX\b/gi, 'المصروفات التشغيلية'],
  [/\bCAPEX\b/gi, 'النفقات الرأسمالية'],
  [/\bEBITDA\b/gi, 'الربح قبل الفوائد والضرائب والإهلاك والاستهلاك'],
  [/\bDCF\b/g, 'التدفقات النقدية المخصومة'],
  [/\bWACC\b/g, 'متوسط التكلفة المرجح لرأس المال'],
  [/\bCAGR\b/g, 'معدل النمو السنوي المركب'],
  [/\bMOIC\b/g, 'مضاعف رأس المال المستثمر'],
  [/\bTVPI\b/g, 'إجمالي القيمة إلى رأس المال المدفوع'],
  [/\bDPI\b/g, 'التوزيعات إلى رأس المال المدفوع'],
  [/\bRVPI\b/g, 'القيمة المتبقية إلى رأس المال المدفوع'],
  [/\bESG\b/g, 'البيئة والمجتمع والحوكمة'],
  [/\bKPI\b/gi, 'مؤشر الأداء'],
  [/\bSLA\b/gi, 'اتفاقية مستوى الخدمة'],
  [/\bAI\b/g, 'الذكاء الاصطناعي'],
  [/\bAPI\b/g, 'واجهة برمجة التطبيقات'],
  [/\bOpenXML\b/gi, 'تنسيق المستند المفتوح'],
  [/\bXLSX\b/g, 'جدول بيانات'],
  [/\bPPTX\b/g, 'عرض تقديمي'],
  [/\bCSV\b/g, 'ملف بيانات جدولي'],
  [/\bPDF\b/g, 'ملف مستند'],
  [/\bJSON\b/g, 'ملف بيانات'],
  [/\bHTML\b/g, 'صفحة ويب'],
  [/\bSAR\b/g, 'ريال سعودي'],
  [/\bV2\b/g, 'الإصدار ٢'],
  [/\bP50\b/g, 'السيناريو الوسطي'],
  [/\bP90\b/g, 'السيناريو المتحفظ'],
  [/\bVaR\b/g, 'القيمة المعرضة للمخاطر'],
  [/\bCVaR\b/g, 'القيمة المشروطة المعرضة للمخاطر'],
  [/\bGFA\b/g, 'إجمالي المساحة البنائية'],
  [/\bNLA\b/g, 'صافي المساحة القابلة للتأجير'],
  [/\bADR\b/g, 'متوسط السعر اليومي'],
  [/\bRevPAR\b/g, 'إيراد الغرفة المتاحة'],
  [/\bPayback\b/gi, 'فترة الاسترداد'],
  [/\bStabilized\b/gi, 'الحالة المستقرة'],
  [/\bPreview\b/gi, 'معاينة'],
  [/\bProduction\b/gi, 'الإنتاج'],
]);

function normalizeLocale(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'ar' || raw.startsWith('ar-')) return 'ar-SA';
  if (raw === 'en' || raw.startsWith('en-')) return 'en';
  return null;
}

function isArabicLocale(locale) {
  return normalizeLocale(locale) === 'ar-SA';
}

function presentCode(value, locale = 'ar-SA', fallback = 'حالة نظامية غير معرّفة') {
  if (value === null || value === undefined || value === '') return '—';
  if (!isArabicLocale(locale)) return String(value);
  const raw = String(value).trim();
  if (ARABIC_VALUE_LABELS[raw]) return ARABIC_VALUE_LABELS[raw];
  if (/^[\u0600-\u06FF\u0750-\u077F\s\d%.,،؛:()\-–—/]+$/u.test(raw)) return raw;

  // Translate compositional enum/status codes only when every token is known.
  const tokens = raw.split(/[_\s-]+/).filter(Boolean);
  const translated = tokens.map((token) => ARABIC_VALUE_LABELS[token] || null);
  if (translated.length && translated.every(Boolean)) return translated.join(' — ');
  return fallback;
}

function presentRole(value, locale = 'ar-SA') {
  return presentCode(value, locale, 'دور غير معرّف');
}

function presentMode(value, locale = 'ar-SA') {
  return presentCode(value, locale, 'نوع دراسة غير معرّف');
}

function presentReasonCode(value, locale = 'ar-SA') {
  return presentCode(value, locale, 'سبب حوكمي مسجل');
}

function sanitizeArabicUiText(value) {
  if (typeof value !== 'string') return value;
  // Protect interpolation placeholders; their parameter names are implementation
  // identifiers and are never rendered after a successful t(path, params) call.
  const placeholders = [];
  let text = value.replace(/\{\{\w+\}\}/g, (match) => {
    const index = placeholders.push(match) - 1;
    return `§${index}§`;
  });
  for (const [pattern, replacement] of ARABIC_TERM_REPLACEMENTS) text = text.replace(pattern, replacement);
  text = text.replace(/§(\d+)§/g, (_, index) => placeholders[Number(index)] || '');
  return text;
}

function hasVisibleLatinText(value) {
  if (typeof value !== 'string') return false;
  const withoutPlaceholders = value.replace(/\{\{\w+\}\}/g, '');
  return /[A-Za-z]/.test(withoutPlaceholders);
}

module.exports = {
  ARABIC_VALUE_LABELS,
  normalizeLocale,
  isArabicLocale,
  presentCode,
  presentRole,
  presentMode,
  presentReasonCode,
  sanitizeArabicUiText,
  hasVisibleLatinText,
};
