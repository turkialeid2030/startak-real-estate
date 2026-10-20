'use strict';
const { LABELS } = require('../app/valuation-labels');
const { ARABIC_VALUE_LABELS } = require('./strict-arabic-presentation');

const REASONS = Object.freeze({
  IMAGE_OCR_NOT_RUN:['اختر قراءة الصفحة ضوئيًا لاستخراج نص الصورة محليًا.','Choose local OCR to extract text from this image.'],
  OCR_UNVERIFIED_REVIEW_REQUIRED:['نص مستخرج ضوئيًا غير متحقق؛ قارنه بالأصل قبل الاعتماد.','Unverified OCR text; compare it with the original before adoption.'],
  OCR_SELECTED_PAGE_ONLY:['النتيجة تخص الصفحة المختارة فقط؛ باقي الملف لم يُقرأ ضوئيًا.','Only the selected page was processed; other pages were not OCR-read.'],
  OCR_NUMBERS_AND_LAYOUT_REVIEW_REQUIRED:['راجع الأرقام والفواصل والتواريخ وترتيب الجدول أمام الصورة؛ درجة الثقة ليست نسبة دقة.','Check numbers, separators, dates and table order against the image; confidence is not accuracy.'],
  OCR_NO_TEXT:['لم يُتعرف على نص في الصفحة؛ راجع جودة الصورة أو استخدم النقل اليدوي.','No text recognized; check image quality or use manual transcription.'],
  OCR_PAGE_INVALID:['أدخل رقم صفحة صحيحًا موجودًا بالملف، بين 1 و200. الصورة المفردة صفحتها 1.','Enter an existing integer page number from 1 to 200; a single image uses page 1.'],
  OCR_LIMIT_EXCEEDED:['تجاوزت القراءة حدود الحجم أو البكسلات أو النص؛ استخدم صورة أصغر أو صفحة أبسط.','OCR exceeded size, pixel or text limits; use a smaller image or simpler page.'],
  OCR_ABORTED:['أُلغيت القراءة الضوئية؛ لم تُقبل نتيجة جزئية.','OCR cancelled; no partial result was accepted.'],
  OCR_TIMEOUT:['انتهت مهلة القراءة الضوئية؛ لم تُقبل نتيجة جزئية.','OCR timed out; no partial result was accepted.'],
  OCR_ENGINE_FAILED:['تعذر تشغيل محرك القراءة المحلي؛ أعد المحاولة أو استخدم النقل اليدوي.','Local OCR failed; retry or use manual transcription.'],
  OCR_IMAGE_INVALID:['تعذر رسم صفحة أو صورة صالحة للقراءة الضوئية؛ راجع الملف الأصلي.','The source could not be rendered as a valid page/image; check the original.'],
  OCR_ASSETS_UNAVAILABLE:['ملفات المحرك المحلي غير متاحة؛ أعد تحميل النسخة المنشورة.','Local OCR assets are unavailable; reload the published version.'],
  OCR_SOURCE_INVALID:['مرجع المصدر أو بصمته غير صالح؛ أرفق الملف الأصلي من جديد.','Invalid source reference/digest; attach the original again.'],
  OCR_RESULT_INVALID:['تعذرت مطابقة النص ومواضعه مع صورة الصفحة؛ لم تُقبل النتيجة.','Text/geometry could not be validated against the page image; result withheld.'],
  OPERATING_AMOUNT_REQUIRED: ['أدخل مبلغًا صريحًا صالحًا؛ الحقل الفارغ لا يعني صفرًا.', 'Enter an explicit valid amount; a blank field is not zero.'],
  OPERATING_CASE_UPDATE_HANDLER_REQUIRED: ['مسار حفظ الحالة غير متاح؛ لم يُحفظ التعديل.', 'The case update handler is unavailable; no change was saved.'],
  OPERATING_CASE_UPDATE_REJECTED: ['لم يؤكد مسار الحفظ قبول التعديل؛ لم يُعلن نجاح الحفظ.', 'The update handler did not confirm acceptance; saving was not reported as successful.'],
  EXPLICIT_VERIFICATION_CONFIRMATION_REQUIRED: ['راجع البيانات وأكد مراجعتها بعد آخر تغيير قبل الحفظ.', 'Review and confirm the data after the last change before saving.'],
  COLLECTION_PERIOD_ENDS_AFTER_AS_OF_DATE: ['نهاية فترة التحصيل تتجاوز تاريخ الحالة؛ راجع الفترة أو حدّث تاريخ الحالة.', 'Collection period ends after the case date; review the period or update the case date.'],
  EXCESS_COLLECTION_REQUIRES_ALLOCATION_REVIEW: ['التحصيل الزائد يحتاج تخصيصًا موثقًا؛ لا يُقاص تلقائيًا مع عجز سجل آخر.', 'Excess collections need documented allocation; they do not automatically offset another record’s shortfall.'],
  NO_QUALIFIED_VALUATION_STAGE: ['لا يوجد منهج تقييم مؤهل بالبيانات الحالية.', 'No qualified valuation stage is available.'],
  PERSONAL_VALUATION_CONFIGURATION_REQUIRED: ['أكمل إعداد التقييم إذا أردت مؤشر قيمة؛ يمكنك حفظ الدراسة المالية الحالية.', 'Complete valuation configuration for a value indication; the financial study may still be saved.'],
  LEGACY_INPUT_VALIDATION_HOLD: ['صحّح المدخل المالي غير الصالح قبل إعادة حساب التقييم.', 'Correct invalid financial inputs before recalculating valuation.'],
  VALUATION_RUNTIME_ERROR: ['تعذر تشغيل التقييم؛ راجع إعداداته والرمز المرفق.', 'Valuation could not run; review its configuration and the attached code.'],
  REQUIRED_FIELD: ['أكمل الحقل المطلوب المحدد في الرسالة.', 'Complete the required field identified in the message.'],
  INVALID_ENUM: ['اختر قيمة مدعومة للحقل المحدد.', 'Select a supported value for the identified field.'],
  INVALID_NUMBER: ['أدخل رقمًا صالحًا للحقل المحدد.', 'Enter a valid number for the identified field.'],
  OUT_OF_RANGE: ['القيمة خارج نطاق الحقل المسموح؛ صححها.', 'The value is outside the permitted field range.'],
  INVALID_CONFIGURATION: ['راجع الحقول المطلوبة ونطاقاتها في إعداد التقييم.', 'Review required configuration fields and ranges.'],
  INVALID_VALUATION_EDITOR_DRAFT: ['تعذر حفظ هذا التغيير في المسودة. قلّل طول النص أو عدد الصفوف؛ احتُفظ بالقيم السابقة.', 'This draft edit could not be saved. Reduce the text length or row count; previous values were retained.'],
  SPECIALIST_HOTEL_ADAPTER_NOT_IMPLEMENTED: ['محرك تقييم الفنادق المتخصص غير متاح؛ البيانات محفوظة كمسودة.', 'A specialist hotel valuation adapter is unavailable; inputs remain a draft.'],
  SPECIALIST_INDUSTRIAL_ADAPTER_NOT_IMPLEMENTED: ['محرك تقييم العقار الصناعي المتخصص غير متاح؛ البيانات محفوظة كمسودة.', 'A specialist industrial valuation adapter is unavailable; inputs remain a draft.'],
  FINANCIAL_INPUTS_INVALID: ['المدخلات المالية غير صالحة؛ لم تُصدر نتائج من حالة سابقة.', 'Financial inputs are invalid; no previous results were exported.'],
  FINANCIAL_COMPUTATION_FAILED: ['تعذر الحساب المالي؛ راجع الرمز المرفق. لم تُصدر نتائج من حالة سابقة.', 'Financial computation failed; review the attached code. No previous results were exported.'],
  CASHFLOWS_UNAVAILABLE: ['التدفقات غير متاحة لحساب أثر الزكاة بالمدخلات الحالية.', 'Cashflows are unavailable to calculate the Zakat effect.'],
  NOT_PROVIDED: ['لم يُدخل مبلغ زكاة؛ لم تحسب المنصة أثرًا مفترضًا.', 'No Zakat amount was supplied; the platform did not assume an effect.'],
  SCENARIO_INPUTS_INVALID: ['هذا السيناريو تجاوز حدود المدخلات المدعومة؛ لم تحسب له نتائج.', 'This scenario exceeds supported input bounds; no results were calculated.'],
  MISSING_EXIT_CAP_RATE: ['أدخل معدل رسملة التخارج لاحتساب التدفقات التي تشمل البيع.', 'Enter the exit capitalization rate to calculate sale-dependent returns.'],
  MISSING_EXIT_TRANSFER_FEE_RATE: ['حدد افتراض تكلفة التخارج صراحة، بما فيها الصفر عند انطباقه.', 'Explicitly specify the exit transaction-cost assumption, including zero where applicable.'],
  CONTRACTUAL_LEASE_COVERAGE_INSUFFICIENT: ['فترة التغطية التعاقدية لا تغطي أفق الدراسة المطلوب.', 'Contractual lease coverage does not cover the required study horizon.'],
});

const SECTIONS = Object.freeze({
  assignment:"تكليف الدراسة",scope:"نطاق العمل",documents:"أدلة المستندات",inspection:"الفحص الفني",market:"أدلة السوق",hbu:"أفضل وأعلى استخدام",valuation:"التقييم",development:"التطوير",finance:"التمويل",reconciliation:"ترجيح النتائج",uncertainty:"عدم اليقين",review:"المراجعة المستقلة",reporting:"التقرير",scenarios:"السيناريوهات",risks:"المخاطر",investmentCommittee:"ملف اللجنة",governance:"الحوكمة",
  TECHNICAL_INSPECTION: 'الفحص الفني', LEGAL_DUE_DILIGENCE: 'الفحص القانوني',
  TITLE_AND_OWNERSHIP: 'الصك والملكية', REGULATORY_COMPLIANCE: 'المتطلبات النظامية',
  MARKET_ANALYSIS: 'تحليل السوق', FINANCIAL_MODEL: 'النموذج المالي',
  VALUATION: 'التقييم', FINANCING: 'التمويل', GOVERNANCE: 'الحوكمة',
  COMMERCIAL_DUE_DILIGENCE: 'الفحص التجاري', DOCUMENT_EVIDENCE: 'أدلة المستندات',
});
const EXTRA_REASONS = Object.freeze({
  RECORDED_HUMAN_COMMITTEE_DECISION_REQUIRED:'يلزم تسجيل قرار اللجنة البشري مع مرجع موثق قبل متابعة هذا المسار.',
  HOLD_COMMITTEE_DECISION:'متابعة الإجراءات معلقة لحين تسجيل قرار اللجنة البشري.',
  EVIDENCE:'إجراء لاستكمال مراجع الأدلة ومراجعتها.',
  LEGAL_REVIEW:'إجراء مراجعة قانونية يتطلب مختصًا مرخصًا.',
  TECHNICAL_DD:'إجراء فحص فني يتطلب مراجعة مختص.',
  VALUATION_REVIEW:'إجراء مراجعة التقييم من المختص المؤهل.',
  INVALID_RENTAL_CALENDAR:'أدخل تاريخ بدء صالحًا وحدد نطاق الموقع ونوع الإيجار.',
  REGULATORY_CONTEXT_MISSING:'لم يكتمل تاريخ الدراسة ونطاق الموقع ونوع الإيجار؛ النمو افتراض غير مؤهل للاعتماد الفعلي.',
  RENT_GROWTH_REVIEW_REQUIRED:'النمو الإيجاري المفترض يتداخل مع فترة الضبط المحتملة؛ يحتاج مراجعة العقد والموقع وأي اعتراض مقبول.',
  RENT_FREEZE_PERIOD_REVIEW_REQUIRED:'الفترة تتداخل مع نطاق الضبط المحتمل؛ ثبات النمو لا يثبت وحده تطبيق الأنظمة.',
  OUTSIDE_CHECKED_RENT_FREEZE_SCOPE_REVIEW_REQUIRED:'الفترة أو الموقع خارج النطاق الذي فُحص هنا؛ راجع العقد والأنظمة السارية ولا تفترض الامتثال.',
  REGULATORY_SOURCE_RECHECK_REQUIRED:'حان موعد إعادة فحص المصدر الرسمي قبل استخدام نتيجة مراجعة الأنظمة.',

  INVALID_INPUT_PROVENANCE:"أكمل المصدر والتاريخ والوحدة والنطاق والمسجل؛ المصدر المستندي يحتاج بصمة من 64 محرفًا.",
  SOURCE_NOT_RECORDED:"لم يُسجل مرجع مصدر لهذا المدخل؛ يبقى افتراضًا غير متحقق.",
  USER_SUPPLIED_UNVERIFIED:"مصدر أدخله المستخدم ولم تُثبت صحته بمراجعة مستقلة.",
  VALUE_CHANGED_RECHECK_SOURCE:"تغيرت قيمة المدخل بعد تسجيل المصدر؛ راجع مطابقته قبل الاعتماد.",
  DOCX_LIMIT_EXCEEDED:'تجاوز مستند Word حدود النص أو الفقرات؛ قسّمه إلى أجزاء أصغر.',
  INVALID_DOCX_PACKAGE:'ملف Word غير صالح أو تالف؛ أعد تصديره.',
  DOCX_MAIN_TEXT_ONLY_NO_PAGE_LAYOUT_IMAGES_OR_LINK_FETCH:'نص المستند الأساسي فقط؛ الصور وترقيم الصفحات والملاحظات خارج الاستخراج ولا تُفتح الروابط.',
  PDF_NO_EXTRACTABLE_TEXT: 'لم يُعثر على نص قابل للاستخراج؛ اختر القراءة الضوئية المحلية للصفحة المطلوبة، أو أدخل المحتوى يدويًا مع رقم الصفحة.',
  PDF_PARTIALLY_TEXTLESS: 'بعض الصفحات بلا نص قابل للاستخراج؛ قد تكون صورًا أو صفحات فارغة. راجعها قبل اعتماد المحتوى.',
  PDF_TEXT_ONLY_NOT_VISUAL_READING_ORDER: 'استخراج نصي فقط؛ ترتيب العناصر والجداول والأرقام يحتاج مراجعة أمام الصفحة الأصلية.',
  PDF_PASSWORD_REQUIRED: 'الملف محمي بكلمة مرور؛ أرفق نسخة مصرحًا لك بقراءتها دون حماية.',
  PDF_INVALID_OR_CORRUPT: 'ملف PDF تالف أو غير صالح؛ أعد تصديره من مصدره.',
  PDF_LIMIT_EXCEEDED: 'الملف تجاوز حدود الصفحات أو النص أو العناصر؛ قسّمه إلى أجزاء أصغر.',
  PDF_FILE_TOO_LARGE: 'حجم الملف يتجاوز حد المعالجة المحلي البالغ 40 ميغابايت.',
  PDF_PARSER_TIMEOUT: 'انتهت مهلة تحليل الملف؛ قسّمه إلى أجزاء أصغر وأعد المحاولة.',
  PDF_PARSER_ABORTED: 'أُلغيت المعالجة؛ لم تعتمد نتيجة جزئية.',
  PDF_READER_UNAVAILABLE: 'تعذر تحميل قارئ PDF المحلي؛ أعد المحاولة أو استخدم الإدخال اليدوي الموثق.',
  INVALID_PDF_HEADER: 'بداية الملف لا تطابق تنسيق PDF؛ تحقق من الملف الأصلي.',
  MANUAL_TRANSCRIPTION_UNVERIFIED: 'هذا المحتوى نُقل يدويًا ولم يُتحقق من مطابقته للمصدر بعد.',
  REQUIRED_EVIDENCE_NOT_SATISFIED: 'أرفق مراجع الأدلة المطلوبة قبل طلب إغلاق الإجراء.',
  LICENSED_PROFESSIONAL_REVIEW_REQUIRED: 'يلزم مرجع مراجعة مختص مرخص لهذا الإجراء؛ إدخال المرجع لا يثبت صحة الترخيص.',
  HUMAN_CLOSURE_REVIEW_REQUIRED: 'يلزم اسم المراجع وتاريخ المراجعة وتوثيقها قبل الإغلاق.',
  REQUIRED_AI_ROLE_OUTPUTS_MISSING: 'لم تُقدّم مخرجات أدوار التحليل والنقد والتركيب المؤهلة بالمصادر.',
  DECISION_INTELLIGENCE_RECORDS_NOT_SUPPLIED_BY_CANONICAL_CASE_PATH: 'يلزم إرفاق أدلة وافتراضات ومراجعات مؤهلة لمساحة القرار؛ التجميع الحالي لا ينشئها تلقائيًا.',
  ACTION_REVIEW_SCOPE_MISMATCH: 'الإجراء أو دليله ينتمي إلى مشروع أو حالة أخرى؛ اختر السجل المطابق.',
  LOCAL_RECORD_INVALID: 'السجل المحلي غير صالح أو يتجاوز الحدود؛ احتُفظ بالسجل السابق.',
  LOCAL_RECORD_SCOPE_MISMATCH: 'النسخة المستوردة تخص حالة أو مصدرًا آخر؛ لم تُطبق.',
  LOCAL_RECORD_UNAUTHENTICATED: 'الهوية والمراجعة بيانات محلية يصرح بها المستخدم؛ لم تُثبت مصادقة مؤسسية.',
  STORAGE_QUOTA_EXCEEDED: 'امتلأت مساحة المتصفح؛ صدّر السجلات قبل حذف بيانات قديمة.',
});

function describeDiagnostic(value, locale = 'ar-SA') {
  const code = String(value ?? '');
  const ar = locale !== 'en';
  if (/[\u0600-\u06ff]/.test(code)) return Object.freeze({code:'',message:code});
  const catalog = LABELS[ar ? 'ar-SA' : 'en'];
  const lifecycle = /^LIFECYCLE_GAP:([^:]+)$/.exec(code);
  const known = (ar && lifecycle ? `أكمل ${SECTIONS[lifecycle[1]] || ARABIC_VALUE_LABELS[lifecycle[1]] || 'مرحلة دورة الحياة المحددة بالرمز'} وأرفق مرجع المراجعة المطلوب.` : null)
    || (ar ? EXTRA_REASONS[code] : null) || catalog?.reason?.[code] || catalog?.method?.[code] || catalog?.state?.[code] || catalog?.engineStatus?.[code] || REASONS[code]?.[ar ? 0 : 1]
    || (ar ? ARABIC_VALUE_LABELS[code] : null);
  return Object.freeze({ code, message: known || (ar
    ? 'تحتاج هذه الحالة إلى مراجعة تفصيلية وفق الرمز المرفق؛ لم يُحذف السبب الأصلي.'
    : 'Review this condition using the attached code; the original reason is retained.') });
}
module.exports = { describeDiagnostic, REASONS };
