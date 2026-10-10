'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const { JSDOM } = require('jsdom');
const React = require('react');
const { createRoot } = require('react-dom/client');
const gold = require('../reference/RE-GOLD-baseline.json');
const { V2_APPROVED_ASSUMPTIONS } = require('../../src/assumptions/assumption-model');
const { buildPersonalFinancialStudy, verifyPersonalFinancialStudy, htmlFinancialStudy } = require('../../src/app/personal-financial-study');
const { updateValuationEditorDraft, validateValuationEditorDraft, copyValuationEditorDraft, rebaseValuationEditorDraft } = require('../../src/app/valuation-editor-draft');
const { advancedDraftFromValuationCase } = require('../../src/app/valuation-advanced-draft');
const { emptyValuationCaseDraft } = require('../../src/app/valuation-case-draft');
const { emptyCriticalEvidenceRow } = require('../../src/app/critical-evidence-draft');
const { describeDiagnostic } = require('../../src/i18n/diagnostic-presentation');
const { validateSavedDealRecord } = require('../../src/validation/saved-deal-schema');
const { buildExportPayload, planRestore } = require('../../src/storage/saved-deals-backup');
let checks = 0;
const ok = (value, message) => { assert.ok(value, message); checks++; };
const eq = (actual, expected, message) => { assert.deepEqual(actual, expected, message); checks++; };
const close = (actual, expected, tolerance, message) => ok(Math.abs(actual - expected) < tolerance, message);
const make = (mode, inputs, version = 'LEGACY') => buildPersonalFinancialStudy({ mode, inputs, assumptionModelVersion: version,
  generatedAt: '2026-10-10T01:27:00Z', dealName: 'AUDIT ONLY 20261010 OFFICE / عقار' });

(async () => {
  const building = { ...gold['RE-GOLD-002_existing_building'].inputs };
  const land = { ...gold['RE-GOLD-001_land_development'].inputs };
  const b = make('building', building), l = make('land', land);
  ok(verifyPersonalFinancialStudy(b) && verifyPersonalFinancialStudy(l), 'both modes produce verified current-input reports');
  eq(b.financial.inputs, building, 'no mutation or alternate financial inputs');
  close(b.financial.payback.simpleCostOverFirstOperatingNoiYears, 10.308456444915265, 1e-9, 'independent fixed-NOI cost ratio');
  eq(b.financial.payback.cumulativeOperatingWithinStudyYears, null, 'five operating years do not recover purchase');
  eq(b.financial.payback.cumulativeWithTerminalSaleYears, 5, 'sale-dependent recovery occurs at year five, not interpolated before sale');
  eq(b.financial.payback.engineOperatingHorizonYears, 30, 'engine horizon disclosed separately from five-year hold');
  const growing = make('building', { ...building, rentGrowthRate: 0.05 });
  ok(growing.financial.payback.engineCumulativeOperatingYears < growing.financial.payback.simpleCostOverFirstOperatingNoiYears,
    'growing cumulative recovery is not mislabeled as fixed-NOI ratio');
  const lv2 = make('land', { ...land, ...V2_APPROVED_ASSUMPTIONS }, 'V2');
  close(lv2.financial.results.maxJustifiedLandPricePerSqm, 13603.01, 1e-8, 'F02 audited calendar boundary remains intact');
  close(lv2.financial.results.firstOperatingYearNOI, 11468096.64, 1e-6, 'F07 does not replace financial engine');
  eq(l.financial.annualCashflows[1].operatingNoi, 0, 'no operating income during construction');
  eq(l.financial.annualCashflows.length, 13, 'year zero, two construction years and ten operating years retained');
  eq(l.financial.experiments.sensitivity.length, 3, 'land rental, construction and purchase sensitivities calculated');
  ok(l.financial.experiments.sensitivity.every(s => s.low.metrics.irr !== s.high.metrics.irr), 'sensitivity changes actual canonical results');
  eq(l.financial.experiments.scenarios[0].metrics.irr, l.financial.results.irr, 'base scenario is the original financial result');
  ok(l.financial.experiments.scenarios[2].metrics.npv < l.financial.results.npv, 'compound downside reduces actual NPV');
  eq(b.financial.experiments.sensitivity[2].high.appliedChanges[0].effective, 1, 'occupancy bounded at actual 100% with disclosure');
  ok(b.financial.experiments.sensitivity[2].high.appliedChanges[0].boundaryLimited, 'boundary clipping explicitly recorded');
  const invalid = make('building', { ...building, buildingPrice: -1 });
  eq(invalid.financial.inputs.buildingPrice, -1, 'invalid original price preserved');
  eq(invalid.financial.results, null, 'invalid current inputs cannot export a prior valid result');
  eq(invalid.financial.status, 'INPUTS_INVALID', 'invalid financial draft explicit');
  eq(invalid.financial.annualCashflows, [], 'invalid draft has no invented annual cashflows');
  const tampered = JSON.parse(JSON.stringify(b)); tampered.financial.results.NOI += 1;
  ok(!verifyPersonalFinancialStudy(tampered), 'editing a reported metric invalidates its fingerprint');
  const html = htmlFinancialStudy(b);
  for (const [mode, inputs] of [['building', building], ['land', land]]) {
    const unlevered = make(mode, inputs), levered = make(mode, { ...inputs, leverageEnabled: true });
    eq(levered.financial.results.totalCriteria, unlevered.financial.results.totalCriteria + 2, 'financing adds exactly the two engine criteria in ' + mode);
    ok(htmlFinancialStudy(levered).includes(levered.financial.results.metCount + ' / ' + levered.financial.results.totalCriteria), 'HTML reports actual engine criteria in ' + mode);
  }
  ok(html.includes('التدفقات السنوية') && html.includes('قبل احتياطي الإحلال') && html.includes('سيناريوهات اختبار افتراضية'), 'financial report includes cashflows, reserve basis and scenarios');
  ok(html.includes('غير متحقق ضمن مدة الدراسة') && html.includes('dir="rtl"'), 'Arabic report preserves unavailable operating payback and RTL');
  ok(html.includes(b.inputFingerprintSha256) && html.includes(b.reportHashSha256), 'input and report fingerprints included');
  const unsafe = buildPersonalFinancialStudy({ mode: 'building', inputs: building, assumptionModelVersion: 'LEGACY', dealName: '<script>alert(1)</script>' });
  ok(!htmlFinancialStudy(unsafe).includes('<script>') && htmlFinancialStudy(unsafe).includes('&lt;script&gt;'), 'untrusted user name is escaped in standalone HTML');
  const zero = make('building', { ...building, commissionRate: 0 });
  eq(zero.financial.inputs.commissionRate, 0, 'real zero stays distinct from missing');
  eq(describeDiagnostic('EVIDENCE_QUALITY_POLICY_REQUIRED').code, 'EVIDENCE_QUALITY_POLICY_REQUIRED', 'original hold code retained');
  ok(describeDiagnostic('EVIDENCE_QUALITY_POLICY_REQUIRED').message.includes('الأدلة'), 'known hold has a semantic Arabic explanation');
  eq(describeDiagnostic('UNREGISTERED_REASON_X').code, 'UNREGISTERED_REASON_X', 'unknown diagnostic cannot be hidden');
  const base = emptyValuationCaseDraft(); base.projectId = 'DRAFT-UNAPPLIED';
  const draft = updateValuationEditorDraft(null, 'base', base);
  eq(draft.status, 'UNAPPLIED_NOT_VERIFIED', 'partial configuration never becomes an approval');
  const copied = copyValuationEditorDraft(draft); copied.base.projectId = 'CHANGED';
  eq(draft.base.projectId, 'DRAFT-UNAPPLIED', 'copied draft does not mutate the source');
  const advancedDraft = advancedDraftFromValuationCase(null);
  advancedDraft.marketComparable.subjectArea = 'UNAPPLIED-AREA';
  const combined = updateValuationEditorDraft(draft, 'advanced', advancedDraft);
  const newCase = { projectId: 'APPLIED', marketComparableInput: { currency: 'SAR' } };
  const retainedBase = rebaseValuationEditorDraft(combined, 'advanced', newCase);
  eq(retainedBase.base.projectId, 'DRAFT-UNAPPLIED', 'applying advanced settings retains unapplied base edits');
  eq(retainedBase.base.preservedAdvanced.marketComparableInput, newCase.marketComparableInput, 'later base apply cannot overwrite newly applied advanced settings');
  eq(rebaseValuationEditorDraft(combined, 'base', newCase).advanced.marketComparable.subjectArea, 'UNAPPLIED-AREA', 'applying base retains unapplied advanced edits');
  eq(rebaseValuationEditorDraft(draft, 'base', newCase), null, 'successful apply removes only the applied editor group');
  eq(rebaseValuationEditorDraft(combined, 'base', null), null, 'explicit disable clears the editor draft');
  const deal = { id: 'audit-f06', name: 'AUDIT ONLY 20261010 OFFICE', mode: 'building', inputs: building, savedAt: '2026-10-10', valuationEditorDraft: draft };
  eq(validateSavedDealRecord(deal), deal, 'partial editor draft persists without applying its configuration');
  const provider = { get: async key => key === 'deal:audit-f06' ? JSON.stringify(deal) : null };
  const backup = await buildExportPayload([{ id: deal.id }], provider);
  eq(backup.deals[0].valuationEditorDraft, draft, 'backup preserves unapplied editor data');
  const restored = planRestore(backup, [], new Map()).toWrite[0].record;
  eq(restored.valuationEditorDraft, draft, 'restore preserves full partial draft');
  eq(restored.name, deal.name, 'backup and restore preserve English user names byte for byte');
  assert.throws(() => validateValuationEditorDraft({ ...draft, status: 'APPROVED' })); checks++;
  assert.throws(() => validateValuationEditorDraft({ ...draft, base: { ...base, projectId: {} } })); checks++;
  assert.throws(() => validateSavedDealRecord({ ...deal, mode: 'land' })); checks++;
  const dom = new JSDOM('<div id="root"><button><span data-user-content><b>AUDIT ONLY 20261010 OFFICE</b></span></button><span data-diagnostic-content><code>UNREGISTERED_REASON_X</code></span><span id="label">Project</span></div>');
  const file = path.resolve(__dirname, '../../src/components/StrictArabicSurfaceGuard.jsx');
  const source = fs.readFileSync(file, 'utf8').replace(/^import React,.*\n/m, '').replace('export default function ', 'function ').replace(/export \{[^}]+\};/, '');
  const context = { require: createRequire(file), document: dom.window.document, NodeFilter: dom.window.NodeFilter };
  vm.runInNewContext(source + '\nprocessTree(document.getElementById("root"));', context);
  eq(dom.window.document.querySelector('[data-user-content]').textContent, deal.name, 'Arabic DOM guard leaves nested user data unchanged');
  eq(dom.window.document.querySelector('code').textContent, 'UNREGISTERED_REASON_X', 'Arabic DOM guard leaves original diagnostic code intact');
  eq(dom.window.document.getElementById('label').textContent, 'المشروع', 'system labels still translate normally');
  dom.window.close();

  // Exercise the actual shared hook and App update handlers in React. This is
  // a component test; the separate Chromium suite verifies the real input UI.
  const reactDom = new JSDOM('<div id="root"></div>', { url: 'http://localhost' });
  const previousWindow = global.window, previousDocument = global.document;
  global.window = reactDom.window; global.document = reactDom.window.document;
  global.IS_REACT_ACT_ENVIRONMENT = true;
  const hookFile = path.resolve(__dirname, '../../src/components/useConfigurationDraft.js');
  const hookSource = fs.readFileSync(hookFile, 'utf8')
    .replace("import { useEffect, useState } from 'react';", 'const { useEffect, useState } = React;')
    .replace('export default function', 'function');
  const useDraft = new Function('React', hookSource + '\nreturn useConfigurationDraft;')(React);
  const appSource = fs.readFileSync(path.resolve(__dirname, '../../src/app/App.jsx'), 'utf8');
  const setterBody = appSource.match(/const setValuationEditorDraft = \(next\) => \{([\s\S]*?)\n  \};/)[1];
  const changeBody = appSource.match(/const changeValuationEditorDraft = \(group, draft\) => \{([\s\S]*?)\n  \};/)[1];
  let api;
  function Harness() {
    const [stored, replace] = React.useState(null);
    const ref = React.useRef(null);
    const setStored = new Function('valuationEditorDraftRef', 'replaceValuationEditorDraft', 'return next => {' + setterBody + '}')(ref, replace);
    const change = new Function('setValuationEditorDraft', 'updateValuationEditorDraft', 'return (group, draft) => {' + changeBody + '}')(setStored, updateValuationEditorDraft);
    const [draft, edit, error] = useDraft(null, emptyValuationCaseDraft, stored?.base, value => change('base', value));
    api = { draft, edit, error, stored, change, reset: setStored };
    return React.createElement('p', null, error || draft.projectId || 'EMPTY');
  }
  const root = createRoot(document.getElementById('root'));
  try {
    await React.act(async () => root.render(React.createElement(Harness)));
    await React.act(async () => api.edit({ ...api.draft, projectId: 'ACCEPTED' }));
    await React.act(async () => api.edit({ ...api.draft, projectId: 'X'.repeat(32001) }));
    eq(api.draft.projectId, 'ACCEPTED', 'overlong paste preserves the previous visible value');
    eq(api.stored.base.projectId, 'ACCEPTED', 'overlong paste cannot replace the persistable draft');
    eq(api.error, 'INVALID_VALUATION_EDITOR_DRAFT', 'overlong paste produces an explicit edit error rather than a render exception');
    await React.act(async () => api.edit({ ...api.draft, projectId: 'X'.repeat(32000) }));
    eq(api.draft.projectId.length, 32000, 'exact string limit remains accepted');
    eq(api.error, null, 'a valid edit clears the refusal notice');
    await React.act(async () => {
      api.change('advanced', advancedDraftFromValuationCase(null));
      api.change('critical', [emptyCriticalEvidenceRow()]);
    });
    ok(api.stored.advanced && api.stored.critical && api.stored.base, 'same React batch retains all edited groups');
    let rejected;
    await React.act(async () => { rejected = api.change('critical', Array.from({ length: 301 }, () => emptyCriticalEvidenceRow())); });
    eq(rejected.ok, false, 'oversized row array is refused synchronously');
    eq(api.stored.critical.length, 1, 'refused rows preserve the accepted evidence draft');
    const large = advancedDraftFromValuationCase(null);
    function fillStrings(value) { for (const key of Object.keys(value)) { if (typeof value[key] === 'string') value[key] = 'X'.repeat(32000); else if (value[key] && !Array.isArray(value[key]) && typeof value[key] === 'object') fillStrings(value[key]); } }
    fillStrings(large);
    ok(JSON.stringify(large).length > 300000, 'aggregate-limit fixture exceeds the envelope limit with individually bounded strings');
    await React.act(async () => { rejected = api.change('advanced', large); });
    eq(rejected.ok, false, 'oversized total draft is refused without changing other groups');
    eq(api.stored.base.projectId.length, 32000, 'aggregate rejection retains accepted base edits');
    await React.act(async () => { api.reset(null); api.change('base', emptyValuationCaseDraft()); });
    ok(!api.stored.advanced && !api.stored.critical, 'reset synchronizes the next edit with the cleared context');
  } finally {
    await React.act(async () => root.unmount());
    reactDom.window.close(); global.window = previousWindow; global.document = previousDocument;
    delete global.IS_REACT_ACT_ENVIRONMENT;
  }
  console.log('AUDIT_20261010_F03_F07=PASS checks=' + checks);
})().catch(error => { console.error(error); process.exitCode = 1; });
