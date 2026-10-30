import React, { useEffect } from 'react';
const { useLocale } = require('../i18n/LocaleContext.js');
const {
  ARABIC_VALUE_LABELS,
  GOVERNED_PRESENTATION_TOKENS,
  GOVERNED_PRESENTATION_TOKEN_PATTERN,
  presentCode,
  sanitizeArabicUiText,
} = require('../i18n/strict-arabic-presentation.js');

// Narrow technical-reference boundary for customer-visible controls and Wave 2
// governance provenance. The lower Arabic sanitizer is the single owner of
// governed-token protection; this DOM guard must not wrap those tokens in a
// second sentinel namespace before invoking it.
const { describeDiagnostic } = require('../i18n/diagnostic-presentation.js');
const UNMAPPED_PREFIX = 'نص يحتاج استكمال التعريب؛ الأصل: ';

const APPROVED_TECHNICAL_TOKENS = GOVERNED_PRESENTATION_TOKENS;
const APPROVED_TECHNICAL_TOKEN_PATTERN = GOVERNED_PRESENTATION_TOKEN_PATTERN;

const EXACT_TEXT = Object.freeze({
  'Decision Intelligence Workspace': 'مساحة ذكاء القرار',
  'Investment Committee Decision Dossier': 'ملف قرار لجنة الاستثمار',
  'Controlled Post-Decision Governance': 'حوكمة ما بعد القرار المنضبطة',
  'DOCUMENT INTELLIGENCE · LOCAL INTAKE': 'ذكاء المستندات · الإدخال المحلي',
  'EVIDENCE QUALIFICATION · HUMAN SEMANTIC MAPPING': 'تأهيل الأدلة · الربط الدلالي البشري',
  'EVIDENCE GOVERNANCE · HUMAN VERIFICATION': 'حوكمة الأدلة · التحقق البشري',
  'Residential Income Acquisition Intelligence': 'تحليل الاستحواذ على العقارات السكنية المدرة للدخل',
  'Project:': 'المشروع:',
  'Case:': 'الحالة:',
  Project: 'المشروع',
  Case: 'الحالة',
  Asset: 'الأصل',
  Lifecycle: 'دورة الحياة',
  Strategy: 'الاستراتيجية',
  'Workspace ID': 'معرّف مساحة العمل',
  'Project ID': 'معرّف المشروع',
  'Case ID': 'معرّف الحالة',
  'Actor ID': 'معرّف المستخدم',
  'Switch to English': 'التبديل إلى الإنجليزية',
  MB: 'ميغابايت',
  XLSX: 'جدول بيانات',
  PPTX: 'عرض تقديمي',
  PDF: 'ملف مستند',
  STRING: 'نص',
  NUMBER: 'رقم',
  BOOLEAN: 'نعم أو لا',
  DATE: 'تاريخ',
  SUPPORTING: 'مساند',
  MATERIAL: 'جوهري',
  YES: 'نعم',
  NO: 'لا',
  true: 'نعم',
  false: 'لا',
  PARSED: 'تم التحليل',
  REJECTED: 'مرفوض',
  decisionThresholds: 'حدود القرار',
  scenarioRisk: 'مخاطر السيناريوهات',
  valuation: 'التقييم',
  financial: 'التحليل المالي',
  'Valuation V1': 'التقييم — الإصدار الأول',
  'Legacy Only': 'المسار المالي الحالي',
  'C75 · PERSONAL RESEARCH': 'الدراسة الشخصية',
});

const INLINE_TERMS = Object.freeze([
  [/\bDOCUMENT INTELLIGENCE\b/gi, 'ذكاء المستندات'],
  [/\bLOCAL INTAKE\b/gi, 'الإدخال المحلي'],
  [/\bEVIDENCE QUALIFICATION\b/gi, 'تأهيل الأدلة'],
  [/\bHUMAN SEMANTIC MAPPING\b/gi, 'الربط الدلالي البشري'],
  [/\bProject\s*:/gi, 'المشروع:'],
  [/\bCase\s*:/gi, 'الحالة:'],
  [/\bAsset\b/g, 'الأصل'],
  [/\bLifecycle\b/g, 'دورة الحياة'],
  [/\bStrategy\b/g, 'الاستراتيجية'],
  [/\bXLSX\b/g, 'جدول بيانات'],
  [/\bPPTX\b/g, 'عرض تقديمي'],
  [/\bPDF\b/g, 'ملف مستند'],
  [/\bDOCX\b/g, 'مستند وورد'],
  [/\bWord\b/g, 'وورد'],
  [/\bMB\b/g, 'ميغابايت'],
  [/\bN\+1\b/g, '(مدة الدراسة + سنة واحدة)'],
  [/\b(\d+(?:\.\d+)?)x\b/g, '$1×'],
  [/\bSHA-?256\b/gi, 'البصمة الرقمية'],
  [/\bverified\s*=\s*true\b/gi, 'تم التحقق: نعم'],
  [/\bverified\s*=\s*false\b/gi, 'تم التحقق: لا'],
]);

const TECHNICAL_REFERENCE = /^(?:https?:\/\/\S+|[a-f0-9]{16,}|[A-Za-z0-9._:@/-]+\.(?:json|xlsx|pptx|pdf)|[A-Za-z]+[-_:][A-Za-z0-9._:-]*\d[A-Za-z0-9._:-]*)$/i;
const ALL_CAPS_CODE = /^[A-Z][A-Z0-9_:-]{1,}$/;

function translateCodeTokens(text) {
  return text.replace(/\b[A-Z][A-Z0-9_]{1,}\b/g, (token) => {
    // Governed production-contract tokens are provenance/status markers, not
    // generic enums. The lower sanitizer has already restored them here.
    if (APPROVED_TECHNICAL_TOKENS.has(token)) return token;
    if (ARABIC_VALUE_LABELS[token]) return ARABIC_VALUE_LABELS[token];
    return token;
  });
}

function translateArabicSurfaceText(value) {
  if (value === null || value === undefined) return value;
  const original = String(value);
  const trimmed = original.trim();
  if (!trimmed || trimmed.startsWith(UNMAPPED_PREFIX)) return original;
  if (TECHNICAL_REFERENCE.test(trimmed)) return original;
  if (APPROVED_TECHNICAL_TOKENS.has(trimmed)) return original;
  if (EXACT_TEXT[trimmed]) return original.replace(trimmed, EXACT_TEXT[trimmed]);
  if (ALL_CAPS_CODE.test(trimmed)) {
    if (ARABIC_VALUE_LABELS[trimmed]) return original.replace(trimmed, ARABIC_VALUE_LABELS[trimmed]);
    const diagnostic = describeDiagnostic(trimmed);
    return original.replace(trimmed, UNMAPPED_PREFIX + diagnostic.message + ' ' + trimmed);
  }

  // sanitizeArabicUiText is the sole governed-token protector. It preserves V2,
  // EN, MISSING_REQUIRED and EXPLICIT byte-for-byte while translating ordinary
  // customer-facing terms. A second guard-level sentinel would be consumed by
  // the lower sanitizer's own restore phase and is therefore intentionally
  // forbidden here.
  let translated = sanitizeArabicUiText(original);
  for (const [pattern, replacement] of INLINE_TERMS) translated = translated.replace(pattern, replacement);
  translated = translateCodeTokens(translated);

  // Preserve unmapped source text. Diagnostics use DiagnosticText; this fallback
  // is visibly incomplete and idempotent, so MutationObserver cannot erase or loop. Approved technical tokens above are excluded
  // from the prose check but remain exact for governed production diagnostics.
  const proseForLatinCheck = translated.replace(APPROVED_TECHNICAL_TOKEN_PATTERN, '');
  if (/[A-Za-z]/.test(proseForLatinCheck)) {
    return original.replace(trimmed, UNMAPPED_PREFIX + trimmed);
  }
  return translated;
}

function translateAttribute(value) {
  if (!value) return value;
  const exact = {
    'Switch to English': 'التبديل إلى الإنجليزية',
    'WS-...': 'مثال: معرّف مساحة العمل',
    'PROJECT-...': 'مثال: معرّف المشروع',
    'CASE-...': 'مثال: معرّف الحالة',
    'ACTOR-...': 'مثال: معرّف المستخدم',
    'Example: market_rent_per_sqm': 'مثال: إيجار السوق للمتر المربع',
  };
  return exact[value] || translateArabicSurfaceText(value);
}

function processElement(element, remember = () => {}) {
  if (!element || element.nodeType !== 1) return;
  if (element.closest('[data-user-content], [data-diagnostic-content], [translate="no"], script, style, code, pre')) return;
  for (const attr of ['title', 'aria-label', 'placeholder']) {
    if (element.hasAttribute(attr)) {
      const before = element.getAttribute(attr);
      const after = translateAttribute(before);
      if (after !== before) { remember(element, attr, before, after); element.setAttribute(attr, after); }
    }
  }
}

function processTree(root, remember = () => {}) {
  if (!root || typeof document === 'undefined') return;
  if (root.nodeType === 1) processElement(root, remember);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  let node = walker.currentNode;
  while (node) {
    if (node.nodeType === 1) {
      processElement(node, remember);
    } else if (node.nodeType === 3) {
      const parent = node.parentElement;
      if (parent && !parent.closest('[data-user-content], [data-diagnostic-content], [translate="no"], script, style, code, pre, input, textarea')) {
        const before = node.nodeValue;
        const after = translateArabicSurfaceText(before);
        if (after !== before) { remember(node, null, before, after); node.nodeValue = after; }
      }
    }
    node = walker.nextNode();
  }
}

export default function StrictArabicSurfaceGuard() {
  const { locale } = useLocale();

  useEffect(() => {
    if (locale !== 'ar-SA' || typeof document === 'undefined') return undefined;
    const root = document.getElementById('root');
    if (!root) return undefined;

    // React may keep a static node unchanged when the locale changes. Restore
    // only guard-owned mutations; never overwrite a newer React/user value.
    const changes = new Map();
    const remember = (node, attr, before, after) => {
      let fields = changes.get(node);
      if (!fields) { fields = new Map(); changes.set(node, fields); }
      const previous = fields.get(attr);
      fields.set(attr, {before: previous && previous.after === before ? previous.before : before, after});
    };
    let active = true;
    let scheduled = false;
    const run = () => {
      scheduled = false;
      if (active) processTree(root, remember);
    };
    const schedule = () => {
      if (scheduled) return;
      scheduled = true;
      queueMicrotask(run);
    };

    processTree(root, remember);
    const observer = new MutationObserver(schedule);
    observer.observe(root, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['title', 'aria-label', 'placeholder'] });
    return () => {
      active = false;
      observer.disconnect();
      for (const [node, fields] of changes) for (const [attr, {before, after}] of fields) {
        const current = attr === null ? node.nodeValue : node.getAttribute(attr);
        if (current === after) {
          if (attr === null) node.nodeValue = before;
          else node.setAttribute(attr, before);
        }
      }
      changes.clear();
    };
  }, [locale]);

  return null;
}

export { translateArabicSurfaceText, translateAttribute };
