import React, { useEffect } from 'react';
const { useLocale } = require('../i18n/LocaleContext.js');
const {
  ARABIC_VALUE_LABELS,
  GOVERNED_PRESENTATION_TOKENS,
  GOVERNED_PRESENTATION_TOKEN_PATTERN,
  protectGovernedPresentationTokens,
  presentCode,
  sanitizeArabicUiText,
} = require('../i18n/strict-arabic-presentation.js');

// Narrow technical-reference boundary for customer-visible controls and Wave 2
// governance provenance. Reuse the shared governed-token inventory and the same
// collision-resistant protection helper used by the lower Arabic sanitizer so
// nested presentation passes cannot consume each other's sentinels.
const APPROVED_TECHNICAL_TOKENS = GOVERNED_PRESENTATION_TOKENS;
const APPROVED_TECHNICAL_TOKEN_PATTERN = GOVERNED_PRESENTATION_TOKEN_PATTERN;

const EXACT_TEXT = Object.freeze({
  'Decision Intelligence Workspace': 'مساحة ذكاء القرار',
  'Investment Committee Decision Dossier': 'ملف قرار لجنة الاستثمار',
  'Controlled Post-Decision Governance': 'حوكمة ما بعد القرار المنضبطة',
  'DOCUMENT INTELLIGENCE · LOCAL INTAKE': 'ذكاء المستندات · الإدخال المحلي',
  'EVIDENCE QUALIFICATION · HUMAN SEMANTIC MAPPING': 'تأهيل الأدلة · الربط الدلالي البشري',
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
  [/\bMB\b/g, 'ميغابايت'],
  [/\bSHA-?256\b/gi, 'البصمة الرقمية'],
  [/\bverified\s*=\s*true\b/gi, 'تم التحقق: نعم'],
  [/\bverified\s*=\s*false\b/gi, 'تم التحقق: لا'],
]);

const TECHNICAL_REFERENCE = /^(?:https?:\/\/\S+|[a-f0-9]{16,}|[A-Za-z0-9._:@/-]+\.(?:json|xlsx|pptx|pdf)|[A-Za-z]+[-_:][A-Za-z0-9._:-]*\d[A-Za-z0-9._:-]*)$/i;
const ALL_CAPS_CODE = /^[A-Z][A-Z0-9_:-]{1,}$/;

function translateCodeTokens(text) {
  return text.replace(/\b[A-Z][A-Z0-9_]{1,}\b/g, (token) => {
    // Governed production-contract tokens are provenance/status markers, not
    // generic enums. They must remain exact after the lower sanitizer has
    // restored them and before generic code-token presentation runs.
    if (APPROVED_TECHNICAL_TOKENS.has(token)) return token;
    if (ARABIC_VALUE_LABELS[token]) return ARABIC_VALUE_LABELS[token];
    return presentCode(token, 'ar-SA', 'حالة نظامية');
  });
}

function translateArabicSurfaceText(value) {
  if (value === null || value === undefined) return value;
  const original = String(value);
  const trimmed = original.trim();
  if (!trimmed) return original;
  if (TECHNICAL_REFERENCE.test(trimmed)) return original;
  if (APPROVED_TECHNICAL_TOKENS.has(trimmed)) return original;
  if (EXACT_TEXT[trimmed]) return original.replace(trimmed, EXACT_TEXT[trimmed]);
  if (ALL_CAPS_CODE.test(trimmed)) return original.replace(trimmed, presentCode(trimmed, 'ar-SA'));

  const protectedTokens = protectGovernedPresentationTokens(original);
  let translated = sanitizeArabicUiText(protectedTokens.protectedText);
  for (const [pattern, replacement] of INLINE_TERMS) translated = translated.replace(pattern, replacement);

  // Restore before generic code-token translation. The shared PUA sentinel is
  // intentionally an implementation detail of the sanitizer and includes an
  // internal marker that a later generic code regex must never inspect. Once
  // restored, translateCodeTokens explicitly exempts the governed token set.
  translated = protectedTokens.restore(translated);
  translated = translateCodeTokens(translated);

  // Strict fail-closed customer surface: an unmapped English prose fragment is
  // never exposed in Arabic mode. Approved technical tokens above are excluded
  // from the prose check but remain exact for governed production diagnostics.
  const proseForLatinCheck = translated.replace(APPROVED_TECHNICAL_TOKEN_PATTERN, '');
  if (/[A-Za-z]/.test(proseForLatinCheck)) {
    return original.replace(trimmed, 'محتوى واجهة غير معرّب');
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

function processElement(element) {
  if (!element || element.nodeType !== 1) return;
  if (element.matches('script, style, code')) return;
  for (const attr of ['title', 'aria-label', 'placeholder']) {
    if (element.hasAttribute(attr)) {
      const before = element.getAttribute(attr);
      const after = translateAttribute(before);
      if (after !== before) element.setAttribute(attr, after);
    }
  }
}

function processTree(root) {
  if (!root || typeof document === 'undefined') return;
  if (root.nodeType === 1) processElement(root);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  let node = walker.currentNode;
  while (node) {
    if (node.nodeType === 1) {
      processElement(node);
    } else if (node.nodeType === 3) {
      const parent = node.parentElement;
      if (parent && !parent.matches('script, style, code, input, textarea')) {
        const before = node.nodeValue;
        const after = translateArabicSurfaceText(before);
        if (after !== before) node.nodeValue = after;
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

    let scheduled = false;
    const run = () => {
      scheduled = false;
      processTree(root);
    };
    const schedule = () => {
      if (scheduled) return;
      scheduled = true;
      queueMicrotask(run);
    };

    processTree(root);
    const observer = new MutationObserver(schedule);
    observer.observe(root, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['title', 'aria-label', 'placeholder'] });
    return () => observer.disconnect();
  }, [locale]);

  return null;
}

export { translateArabicSurfaceText, translateAttribute };
