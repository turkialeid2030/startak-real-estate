'use strict';

const C41_SURFACE_MANIFEST = Object.freeze({
  applicationModel: 'SINGLE_PAGE_MODE_TAB_MATRIX',
  modes: Object.freeze(['building', 'land']),
  tabs: Object.freeze(['dashboard', 'cashflow', 'sensitivity']),
  locales: Object.freeze(['ar-SA', 'en']),
  viewports: Object.freeze([
    Object.freeze({ key: 'desktop', width: 1440, height: 1200 }),
    Object.freeze({ key: 'mobile', width: 390, height: 844 }),
  ]),
  interactionClasses: Object.freeze([
    'numeric-inputs',
    'optional-percent-inputs',
    'selects',
    'switches',
    'accordions',
    'mode-switch',
    'tabs',
    'saved-deals',
    'reset',
    'delete',
    'locale-toggle',
    'valuation-intelligence',
    'governed-human-review',
    'residential-income-acquisition',
    'zakat-layer',
  ]),
});

const matrixCount = C41_SURFACE_MANIFEST.modes.length
  * C41_SURFACE_MANIFEST.tabs.length
  * C41_SURFACE_MANIFEST.locales.length
  * C41_SURFACE_MANIFEST.viewports.length;

if (matrixCount !== 24) throw new Error(`C41 surface matrix must contain 24 mode/tab/locale/viewport combinations; got ${matrixCount}`);

module.exports = { C41_SURFACE_MANIFEST, C41_SURFACE_MATRIX_COUNT: matrixCount };
