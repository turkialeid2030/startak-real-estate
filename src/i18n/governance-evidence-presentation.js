'use strict';
// System-owned codes only. Never apply to source text or stored domain values.
const LABELS = Object.freeze({
  "OFFICIAL_PRIMARY": [
    "مصدر رسمي أولي",
    "Official primary source"
  ],
  "LICENSED_PROFESSIONAL": [
    "مختص مرخص",
    "Licensed professional"
  ],
  "CONTRACTUAL": [
    "مصدر تعاقدي",
    "Contractual source"
  ],
  "INTERNAL_MODEL": [
    "نموذج داخلي",
    "Internal model"
  ],
  "PRESENTATION": [
    "عرض تقديمي",
    "Presentation"
  ],
  "UNKNOWN": [
    "غير محدد",
    "Unknown"
  ],
  "DOCUMENT_ONLY": [
    "مستند فقط",
    "Document only"
  ],
  "EXTRACTED_EVIDENCE": [
    "دليل مستخرج غير متحقق",
    "Unverified extracted evidence"
  ],
  "VERIFIED_FACT": [
    "حقيقة مسجلة كمتحقق منها داخليًا",
    "Fact recorded as internally verified"
  ],
  "NOT_VERIFIED": [
    "غير متحقق منه",
    "Not verified"
  ],
  "VERIFIED": [
    "مسجل كمتحقق منه",
    "Recorded as verified"
  ],
  "STRING": [
    "نص",
    "Text"
  ],
  "NUMBER": [
    "رقم",
    "Number"
  ],
  "BOOLEAN": [
    "نعم أو لا",
    "Boolean"
  ],
  "DATE": [
    "تاريخ",
    "Date"
  ],
  "SUPPORTING": [
    "مساند",
    "Supporting"
  ],
  "MATERIAL": [
    "جوهري",
    "Material"
  ],
  "PARSED": [
    "تم الاستخراج",
    "Parsed"
  ],
  "REJECTED": [
    "مرفوض",
    "Rejected"
  ],
  "REQUIRES_MANUAL_REVIEW": [
    "يلزم فحص يدوي",
    "Manual review required"
  ],
  "UNSUPPORTED": ["غير مدعوم", "Unsupported"],
  "NOT_SUPPORTED": [
    "غير مدعوم",
    "Unsupported"
  ],
  "CELL": [
    "خلية",
    "Cell"
  ],
  "PAGE": [
    "صفحة",
    "Page"
  ],
  "SLIDE": [
    "شريحة",
    "Slide"
  ],
  "SECTION": [
    "قسم",
    "Section"
  ],
  "DOCUMENT_METADATA": [
    "بيانات المستند",
    "Document metadata"
  ],
  "TEXT": [
    "نص",
    "Text"
  ],
  "IMAGE": [
    "صورة",
    "Image"
  ],
  "CANDIDATE_REQUIRES_VERIFICATION": [
    "مرشح يتطلب التحقق",
    "Candidate requires verification"
  ],
  "HOLD_INTAKE_RECORD": [
    "معلق لمراجعة سجل المستند",
    "Held for intake review"
  ],
  "HOLD_PARSER_RESULT": [
    "معلق لمراجعة الاستخراج",
    "Held for parser review"
  ],
  "HOLD_ATOM": [
    "معلق لمراجعة العنصر",
    "Held for atom review"
  ],
  "HOLD_SEMANTIC_MAPPING": [
    "معلق لمراجعة المعنى",
    "Held for semantic review"
  ],
  "HOLD_PROVENANCE": [
    "معلق لاستكمال المصدر",
    "Held for provenance"
  ],
  "READY_FOR_HUMAN_VERIFICATION_DECISION": [
    "جاهز لقرار التحقق البشري",
    "Ready for human verification decision"
  ],
  "HOLD_CANDIDATE": [
    "معلق لمراجعة المرشح",
    "Held for candidate review"
  ],
  "HOLD_ATTESTATION": [
    "معلق لاستكمال حزمة التحقق",
    "Held for attestation"
  ],
  "HOLD_TIMELINE": [
    "معلق لمراجعة التسلسل الزمني",
    "Held for timeline review"
  ],
  "HOLD_EVIDENCE_CHAIN": [
    "معلق لاستكمال سلسلة الأدلة",
    "Held for evidence chain"
  ],
  "VERIFY_FACT": [
    "تسجيل التحقق من الحقيقة",
    "Record fact verification"
  ],
  "REJECT_CANDIDATE": [
    "رفض المرشح",
    "Reject candidate"
  ],
  "DEFER": [
    "تأجيل",
    "Defer"
  ],
  "DECISION_RECORDED": [
    "قرار مسجل",
    "Decision recorded"
  ],
  "HOLD_GATE": [
    "معلق لاستكمال البوابة",
    "Held for verification gate"
  ],
  "HOLD_DECISION": [
    "معلق لاستكمال القرار",
    "Held for decision"
  ],
  "HOLD_ACKNOWLEDGEMENTS": [
    "معلق لاستكمال الإقرارات",
    "Held for acknowledgements"
  ],
  "CASE_ASSEMBLED": [
    "حالة مجمعة",
    "Case assembled"
  ],
  "CASE_ASSEMBLED_WITH_LIFECYCLE_GAPS": [
    "حالة مجمعة مع مراحل غير مكتملة",
    "Case assembled with lifecycle gaps"
  ],
  "READY_FOR_COMMITTEE_PREPARATION": [
    "جاهز لتحضير اللجنة البشرية",
    "Ready for human committee preparation"
  ],
  "HOLD_WORKSPACE": [
    "معلق لمراجعة مساحة العمل",
    "Held for workspace review"
  ],
  "HOLD_OPEN_CRITICAL_ACTIONS": [
    "معلق لإجراءات جوهرية مفتوحة",
    "Held for open critical actions"
  ],
  "HOLD_SCOPE_MISMATCH": [
    "معلق لتعارض النطاق",
    "Held for scope mismatch"
  ],
  "SATISFIED_PENDING_REVIEW": [
    "مستوفى بانتظار المراجعة",
    "Satisfied pending review"
  ],
  "INSUFFICIENT": [
    "غير كافٍ",
    "Insufficient"
  ],
  "ACCEPTED_FOR_REVIEW_ONLY": [
    "مقبول للمراجعة فقط",
    "Accepted for review only"
  ],
  "RECORDED_HUMAN_DECISION": [
    "قرار بشري مسجل",
    "Recorded human decision"
  ],
  "WAITING_FOR_HUMAN_COMMITTEE_DECISION": [
    "بانتظار قرار اللجنة البشري",
    "Waiting for human committee decision"
  ],
  "ACTION_REVIEW_CLOSED": [
    "مراجعة الإجراءات مغلقة",
    "Action review closed"
  ],
  "ACTION_REVIEW_OPEN": [
    "مراجعة الإجراءات مفتوحة",
    "Action review open"
  ],
  "NOT_STARTED": [
    "لم يبدأ",
    "Not started"
  ],
  "LAND": [
    "أرض",
    "Land"
  ],
  "RESIDENTIAL": [
    "سكني",
    "Residential"
  ],
  "OFFICE": [
    "مكاتب",
    "Office"
  ],
  "RETAIL": [
    "تجزئة",
    "Retail"
  ],
  "INDUSTRIAL_LOGISTICS": [
    "صناعي ولوجستي",
    "Industrial and logistics"
  ],
  "HOSPITALITY": [
    "ضيافة",
    "Hospitality"
  ],
  "HEALTHCARE": [
    "رعاية صحية",
    "Healthcare"
  ],
  "EDUCATION": [
    "تعليمي",
    "Education"
  ],
  "MIXED_USE": [
    "استخدام مختلط",
    "Mixed use"
  ],
  "PARKING": [
    "مواقف سيارات",
    "Parking"
  ],
  "DATA_CENTER": [
    "مركز بيانات",
    "Data center"
  ],
  "SPECIAL_PURPOSE": [
    "استخدام خاص",
    "Special purpose"
  ],
  "OTHER": [
    "أخرى",
    "Other"
  ],
  "VACANT": [
    "شاغر",
    "Vacant"
  ],
  "PLANNED": [
    "مخطط",
    "Planned"
  ],
  "UNDER_DEVELOPMENT": [
    "قيد التطوير",
    "Under development"
  ],
  "EXISTING_VACANT": [
    "قائم وشاغر",
    "Existing vacant"
  ],
  "EXISTING_OPERATING": [
    "قائم وتشغيلي",
    "Existing operating"
  ],
  "STABILIZED": [
    "مستقر تشغيليًا",
    "Stabilized"
  ],
  "REDEVELOPMENT": [
    "إعادة تطوير",
    "Redevelopment"
  ],
  "RENOVATION": [
    "تجديد",
    "Renovation"
  ],
  "CONVERSION": [
    "تحويل استخدام",
    "Conversion"
  ],
  "PORTFOLIO": [
    "محفظة",
    "Portfolio"
  ],
  "ACQUIRE_HOLD": [
    "استحواذ واحتفاظ",
    "Acquire and hold"
  ],
  "CORE_INCOME": [
    "دخل أساسي مستقر",
    "Core income"
  ],
  "DEVELOPMENT": [
    "تطوير",
    "Development"
  ],
  "VALUE_ADD": [
    "إضافة قيمة",
    "Value add"
  ],
  "LEASE": [
    "تأجير",
    "Lease"
  ],
  "DISPOSAL": [
    "تخارج",
    "Disposal"
  ],
  "REFINANCE": [
    "إعادة تمويل",
    "Refinance"
  ],
  "JOINT_VENTURE": [
    "مشروع مشترك",
    "Joint venture"
  ],
  "SALE_LEASEBACK": [
    "بيع وإعادة استئجار",
    "Sale and leaseback"
  ],
  "NONE": [
    "دون دخل",
    "None"
  ],
  "LEASE_INCOME": [
    "دخل إيجاري",
    "Lease income"
  ],
  "OPERATING_BUSINESS": [
    "نشاط تشغيلي",
    "Operating business"
  ],
  "UNIT_SALES": [
    "مبيعات وحدات",
    "Unit sales"
  ],
  "MIXED": [
    "مختلط",
    "Mixed"
  ],
  "OPEN": [
    "مفتوح",
    "Open"
  ],
  "IN_PROGRESS": [
    "قيد التنفيذ",
    "In progress"
  ],
  "BLOCKED": [
    "محجوب",
    "Blocked"
  ],
  "CLOSED": [
    "مغلق",
    "Closed"
  ],
  "ANALYST": [
    "المحلل",
    "Analyst"
  ],
  "CHALLENGER": [
    "المراجع الناقد",
    "Challenger"
  ],
  "SYNTHESIZER": [
    "جامع النتائج",
    "Synthesizer"
  ]
});
function governanceEvidenceLabel(code, locale='ar-SA') {
  if(code==null||code==='')return '—';
  const pair=Object.hasOwn(LABELS,code)?LABELS[code]:null;
  return pair?pair[locale==='en'?1:0]:String(code);
}
module.exports={governanceEvidenceLabel,LABELS};
