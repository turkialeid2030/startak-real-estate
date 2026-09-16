'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { evaluateValuationEvidenceFreshness } = require('../../src/decision-governance/valuation-data-freshness');

const valuationCase = {
  evidence: {
    income: {
      grade: 'C_CONTRACTUAL',
      status: 'VERIFIED',
      sourceType: 'LEASE_LEDGER',
      sourceRef: 'LEASE-001',
      observedAt: '2026-09-10',
    },
    capRate: {
      grade: 'E_MARKET_OBSERVATION',
      status: 'OBSERVED',
      sourceType: 'MARKET_OBSERVATION',
      sourceRef: 'CAP-001',
      observedAt: '2026-04-01',
    },
    expenses: {
      grade: 'H_CLIENT_SUPPLIED_UNVERIFIED',
      status: 'UNVERIFIED',
      sourceType: 'CLIENT_INPUT',
      sourceRef: null,
      observedAt: null,
    },
  },
};

const summary = evaluateValuationEvidenceFreshness(valuationCase, {
  asOf: '2026-09-16T00:00:00.000Z',
  agingAfterDays: 30,
  staleAfterDays: 90,
});

assert.strictEqual(summary.evidenceCount, 3);
assert.strictEqual(summary.counts.CURRENT, 1);
assert.strictEqual(summary.counts.STALE, 1);
assert.strictEqual(summary.counts.UNKNOWN, 1);
assert.strictEqual(summary.status, 'STALE');
assert.strictEqual(summary.allMaterialSourcesDated, false);
assert.strictEqual(summary.items.find((item) => item.field === 'income').freshnessStatus, 'CURRENT');
assert.strictEqual(summary.items.find((item) => item.field === 'capRate').freshnessStatus, 'STALE');
assert.strictEqual(summary.items.find((item) => item.field === 'expenses').freshnessStatus, 'UNKNOWN');

const empty = evaluateValuationEvidenceFreshness(null, { asOf: '2026-09-16T00:00:00.000Z' });
assert.strictEqual(empty.status, 'UNKNOWN');
assert.strictEqual(empty.evidenceCount, 0);
assert.strictEqual(empty.allMaterialSourcesDated, false);

const panelSource = fs.readFileSync(path.join(__dirname, '../../src/components/ValuationIntelligencePanel.jsx'), 'utf8');
assert.ok(panelSource.includes("import DataFreshnessPanel from './DataFreshnessPanel.jsx'"));
assert.ok(panelSource.includes('<DataFreshnessPanel'));

console.log('VALUATION_DATA_FRESHNESS_INTEGRATION_TESTS=PASS');
