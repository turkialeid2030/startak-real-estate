'use strict';
const assert = require('node:assert/strict');
const { operatingCase } = require('../fixtures/synthetic-collections-case');
const gold = require('../reference/RE-GOLD-baseline.json');
const { buildPersonalFinancialStudy, verifyPersonalFinancialStudy, htmlFinancialStudy } = require('../../src/app/personal-financial-study');
const context = { mode: 'building', inputs: gold['RE-GOLD-002_existing_building'].inputs,
  assumptionModelVersion: 'LEGACY', generatedAt: '2026-10-17T00:00:00Z' };
const original = JSON.parse(JSON.stringify(operatingCase()));
const before = JSON.stringify(original);
const a = buildPersonalFinancialStudy({ ...context, operatingCase: original });
assert.equal(a.operatingReport.contractRunoff.totals.contractRent, 400000);
assert.equal(a.operatingReport.aggregateEngineUpdated, false);
assert.equal(verifyPersonalFinancialStudy(a), true);
assert.equal(JSON.stringify(original), before);
original.leases[0].baseRent.value = 1320000;
const b = buildPersonalFinancialStudy({ ...context, operatingCase: original });
assert.equal(b.operatingReport.contractRunoff.totals.contractRent, 440000);
assert.notEqual(a.inputFingerprintSha256, b.inputFingerprintSha256);
assert.notEqual(a.operatingReport.sourceFingerprintSha256, b.operatingReport.sourceFingerprintSha256);
assert.deepEqual(a.financial.results, b.financial.results);
const changed = JSON.parse(JSON.stringify(b));
changed.operatingReport.contractRunoff.totals.contractRent = 1;
assert.equal(verifyPersonalFinancialStudy(changed), false);
assert.equal(buildPersonalFinancialStudy(context).operatingReport, null);
assert.equal(buildPersonalFinancialStudy({ ...context, mode: 'land', inputs: gold['RE-GOLD-001_land_development'].inputs, operatingCase: original }).operatingReport, null);
assert.throws(() => buildPersonalFinancialStudy({ ...context, operatingCase: { caseId: 'bad' } }));
for (const locale of ['ar-SA', 'en']) {
  const html = htmlFinancialStudy(b, { locale });
  assert.ok(html.includes(b.operatingReport.sourceFingerprintSha256));
  assert.ok(html.includes(locale === 'en' ? 'not reconciled' : 'لم تُسوَّ'));
}
console.log('OPERATING_REPORT_ATTACHMENT: PASS (source refresh, financial isolation, hash integrity, invalid input, bilingual disclosure)');
