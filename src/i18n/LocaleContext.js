// src/i18n/LocaleContext.js -- React context for locale switching.
// CRITICAL: this module must NEVER be imported by src/engines/** or
// src/validation/**. Locale is a presentation-layer concern only -- the
// calculation engine's inputs/outputs are locale-invariant, confirmed by
// tests/characterization/run_locale_invariance.js.
const React = require('react');
const { createContext, useContext, useState, useEffect, useCallback } = React;
const arSA = require('./locales/ar-SA.js');
const en = require('./locales/en.js');
const { normalizeLocale, sanitizeArabicUiText } = require('./strict-arabic-presentation.js');
const { getAboutMethodology } = require('../decision-governance/model-card');

const LOCALES = { 'ar-SA': { dir: 'rtl', dict: arSA }, en: { dir: 'ltr', dict: en } };
const LOCALE_STORAGE_KEY = 'startak.presentation.locale';
const LocaleContext = createContext(null);

function safeReadStoredLocale() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return normalizeLocale(window.localStorage.getItem(LOCALE_STORAGE_KEY));
  } catch (_) {
    return null;
  }
}

function safeWriteStoredLocale(locale) {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    }
  } catch (_) {
    // Storage may be blocked by browser/privacy policy. Locale selection remains
    // functional for the current session; persistence is best-effort only.
  }
}

function detectBrowserLocale() {
  if (typeof navigator === 'undefined') return null;
  const candidates = Array.isArray(navigator.languages) && navigator.languages.length
    ? navigator.languages
    : [navigator.language];
  // Arabic browsers opt into ar-SA automatically. A non-Arabic browser does
  // not silently override the product's Arabic default; English remains an
  // explicit user choice and is persisted by safeWriteStoredLocale().
  for (const candidate of candidates) {
    const normalized = normalizeLocale(candidate);
    if (normalized === 'ar-SA') return 'ar-SA';
  }
  return null;
}

function resolveInitialLocale(defaultLocale = 'ar-SA') {
  // Explicit saved choice always wins. Otherwise an Arabic browser selects
  // ar-SA; non-Arabic browsers retain the supplied product default.
  return safeReadStoredLocale() || detectBrowserLocale() || normalizeLocale(defaultLocale) || 'ar-SA';
}

// Governance-owned presentation strings must come from their canonical module
// rather than a copied locale literal. App.jsx already renders
// globalApp.methodologyNote in the production footer, so this resolver live-wires
// the Model Card / methodology scope notice without duplicating policy text.
function resolveGovernedPresentationText(path, locale = 'ar-SA') {
  if (path !== 'globalApp.methodologyNote') return null;
  return getAboutMethodology(locale === 'en' ? 'en' : 'ar').notice;
}

function LocaleProvider({ children, defaultLocale = 'ar-SA' }) {
  const [locale, setLocaleState] = useState(() => resolveInitialLocale(defaultLocale));
  const { dir, dict } = LOCALES[locale] || LOCALES['ar-SA'];

  const setLocale = useCallback((nextLocale) => {
    const normalized = normalizeLocale(typeof nextLocale === 'function' ? nextLocale(locale) : nextLocale);
    if (!normalized) return;
    setLocaleState(normalized);
    safeWriteStoredLocale(normalized);
  }, [locale]);

  // Keep the document's semantic language and reading direction synchronized
  // with the presentation locale. This is deliberately presentation-only and
  // never affects financial calculations or persisted engine inputs.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.setAttribute('lang', locale);
    document.documentElement.setAttribute('dir', dir);
    if (document.body) {
      document.body.setAttribute('lang', locale);
      document.body.setAttribute('dir', dir);
    }
  }, [locale, dir]);

  function t(path, params) {
    const governedText = resolveGovernedPresentationText(path, locale);
    if (governedText !== null) {
      let rendered = locale === 'ar-SA' ? sanitizeArabicUiText(governedText) : governedText;
      if (params) {
        rendered = rendered.replace(/\{\{(\w+)\}\}/g, (match, key) => {
          if (!(key in params)) return locale === 'ar-SA' ? 'قيمة غير متاحة' : match;
          return String(params[key]);
        });
      }
      return rendered;
    }

    const parts = path.split('.');
    let cur = dict;
    for (const p of parts) {
      cur = cur?.[p];
      if (cur === undefined) {
        // Fail closed in Arabic mode: never leak an internal English translation
        // key to the customer-facing surface. Regression tests still enforce
        // dictionary parity so this fallback should remain exceptional.
        return locale === 'ar-SA' ? 'نص واجهة غير متاح' : path;
      }
    }
    if (typeof cur === 'string') {
      let rendered = locale === 'ar-SA' ? sanitizeArabicUiText(cur) : cur;
      if (params) {
        rendered = rendered.replace(/\{\{(\w+)\}\}/g, (match, key) => {
          if (!(key in params)) return locale === 'ar-SA' ? 'قيمة غير متاحة' : match;
          return String(params[key]);
        });
      }
      return rendered;
    }
    return cur;
  }

  return React.createElement(LocaleContext.Provider, { value: { locale, setLocale, dir, t } }, children);
}

function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error('useLocale must be used within a LocaleProvider');
  return ctx;
}

module.exports = {
  LocaleProvider,
  useLocale,
  LOCALES,
  LOCALE_STORAGE_KEY,
  normalizeLocale,
  detectBrowserLocale,
  resolveInitialLocale,
  resolveGovernedPresentationText,
};
