// src/i18n/LocaleContext.js -- React context for locale switching.
// CRITICAL: this module must NEVER be imported by src/engines/** or
// src/validation/**. Locale is a presentation-layer concern only -- the
// calculation engine's inputs/outputs are locale-invariant, confirmed by
// tests/characterization/run_locale_invariance.js.
const React = require('react');
const { createContext, useContext, useState, useEffect } = React;
const arSA = require('./locales/ar-SA.js');
const en = require('./locales/en.js');

const LOCALES = { 'ar-SA': { dir: 'rtl', dict: arSA }, en: { dir: 'ltr', dict: en } };
const LocaleContext = createContext(null);

function LocaleProvider({ children, defaultLocale = 'ar-SA' }) {
  const [locale, setLocale] = useState(defaultLocale);
  const { dir, dict } = LOCALES[locale];

  // Keep the document's semantic language and reading direction synchronized
  // with the presentation locale. This is deliberately presentation-only and
  // never affects financial calculations or persisted engine inputs.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.setAttribute('lang', locale);
    document.documentElement.setAttribute('dir', dir);
  }, [locale, dir]);

  function t(path, params) {
    const parts = path.split('.');
    let cur = dict;
    for (const p of parts) { cur = cur?.[p]; if (cur === undefined) return path; }
    if (typeof cur === 'string' && params) {
      return cur.replace(/\{\{(\w+)\}\}/g, (match, key) => {
        if (!(key in params)) return match; // unknown param -- leave placeholder visible, never silently corrupt output
        return String(params[key]);
      });
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

module.exports = { LocaleProvider, useLocale, LOCALES };
