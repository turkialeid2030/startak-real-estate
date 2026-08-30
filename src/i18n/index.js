// src/i18n/index.js -- minimal locale loader. NEVER pass locale into any
// engine/calculation function -- financial results must be locale-invariant.
const arSA = require('./ar-SA.json');
const en = require('./en.json');

const LOCALES = { 'ar-SA': arSA, en };

function getLocale(localeCode) {
  const locale = LOCALES[localeCode];
  if (!locale) throw new Error(`Unknown locale: ${localeCode}`);
  return locale;
}

function t(localeCode, key) {
  const locale = getLocale(localeCode);
  if (!(key in locale.terms)) throw new Error(`Unknown terminology key: ${key}`);
  return locale.terms[key];
}

module.exports = { getLocale, t, LOCALES };
