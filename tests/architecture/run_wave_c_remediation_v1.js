'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { analyzeIRR, IRR_RELIABILITY } = require('../../src/engines/financial');
const { calcExistingBuilding } = require('../../src/engines/valuation/existing-building');
const ar = require('../../src/i18n/locales/ar-SA');
const en = require('../../src/i18n/locales/en');

let checks = 0;
function ok(condition, message) { checks += 1; assert.ok(condition, message); }
const diag = analyzeIRR([-100, 300, -250, 80], { financeRate: 0.08, reinvestRate: 0.08 });
ok(diag.reliability === IRR_RELIABILITY.MULTIPLE_ROOT_RISK, 'multiple-root risk must be disclosed');
ok(diag.presentationMetric === 'MIRR' && Number.isFinite(diag.mirr), 'MIRR fallback must be calculable');
ok(analyzeIRR([-100, 150]).reliability === IRR_RELIABILITY.RELIABLE, 'conventional IRR remains reliable');
const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'characterization', 'fixtures', 'RE-GOLD-002-U.json'), 'utf8')).input_set;
for (const override of [{ occupancyRate: 5 }, { rentGrowthRate: 2 }, { loanRate: -0.05 }, { managementFeeRate: 1.5 }, { fixedOpexPerSqm: -10 }]) {
  let blocked = false;
  try { calcExistingBuilding({ ...fixture, ...override }); } catch (error) { blocked = error && error.name === 'ValidationError'; }
  ok(blocked, `invalid input must fail closed: ${JSON.stringify(override)}`);
}
ok(ar.inputBuilding.managementFeeRate && en.inputBuilding.managementFeeRate, 'expense model fields must be translated');
ok(ar.inputBuilding.insuranceRateNote.includes('الإحلال'), 'Arabic insurance base must disclose replacement value');
const app = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'app', 'App.jsx'), 'utf8');
ok(app.includes('aria-live="polite"') && app.includes('aria-invalid={warning'), 'a11y live/invalid state must be wired');
ok(app.includes('irrIsUnreliable') && app.includes('mirrValue'), 'KPI ribbon must consume IRR reliability');
ok(app.includes('storageFailureMessage'), 'quota-specific save error must be routed');
console.log(`WAVE_C_CHECKS=${checks} FAILED=0`);
