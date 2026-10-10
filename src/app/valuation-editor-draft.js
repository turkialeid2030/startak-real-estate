'use strict';
// Unapplied editor data is never an input to a valuation/financial engine.
const VERSION = 'VALUATION_EDITOR_DRAFT_V1';
const STATUS = 'UNAPPLIED_NOT_VERIFIED';
const GROUPS = ['base', 'advanced', 'critical'];
const { emptyValuationCaseDraft, draftFromValuationCase } = require('./valuation-case-draft');
const { advancedDraftFromValuationCase, emptyComparableDraft } = require('./valuation-advanced-draft');
const { emptyCriticalEvidenceRow } = require('./critical-evidence-draft');
function fail() { const e = new Error('INVALID_VALUATION_EDITOR_DRAFT'); e.code = 'INVALID_VALUATION_EDITOR_DRAFT'; throw e; }
function safeJson(value, depth = 0) {
  if (depth > 16) fail();
  if (value === null || typeof value === 'boolean') return;
  if (typeof value === 'string') { if (value.length > 32000) fail(); return; }
  if (typeof value === 'number') { if (!Number.isFinite(value)) fail(); return; }
  if (!value || typeof value !== 'object') fail();
  if (Array.isArray(value)) { if (value.length > 300) fail(); }
  else if (![Object.prototype, null].includes(Object.getPrototypeOf(value))) fail();
  for (const [key, child] of Object.entries(value)) {
    if (['__proto__', 'prototype', 'constructor'].includes(key)) fail();
    safeJson(child, depth + 1);
  }
}
function validateValuationEditorDraft(draft) {
  if (!draft || typeof draft !== 'object' || Array.isArray(draft)
      || draft.version !== VERSION || draft.status !== STATUS
      || Object.keys(draft).some(key => !['version', 'status', ...GROUPS].includes(key))) fail();
  safeJson(draft);
  if (JSON.stringify(draft).length > 300000) fail();
  for (const key of ['base', 'advanced']) {
    if (draft[key] !== undefined && (!draft[key] || typeof draft[key] !== 'object' || Array.isArray(draft[key]))) fail();
  }
  if (draft.base && (!draft.base.classification || !draft.base.incomePolicy
    || !draft.base.evidencePolicy || !draft.base.singleMethodPolicy)) fail();
  if (draft.advanced && (!draft.advanced.evidence || !draft.advanced.marketComparable
    || !draft.advanced.cost || !draft.advanced.reconciliation)) fail();
  if (draft.critical !== undefined && !Array.isArray(draft.critical)) fail();
  function shape(value, template, path = '') {
    if (['preservedAdvanced', 'preservedEvidenceExtras'].includes(path.split('.').pop())) return;
    if (Array.isArray(template)) {
      if (!Array.isArray(value)) fail();
      const childTemplate = path.endsWith('comparables') ? emptyComparableDraft()
        : path === 'critical' ? emptyCriticalEvidenceRow() : '';
      for (const child of value) shape(child, childTemplate, path + '.item');
    } else if (template && typeof template === 'object') {
      if (!value || typeof value !== 'object' || Array.isArray(value)) fail();
      if (Object.keys(value).some(key => !Object.hasOwn(template, key))) fail();
      for (const [key, childTemplate] of Object.entries(template)) {
        if (!Object.hasOwn(value, key)) fail();
        shape(value[key], childTemplate, path + '.' + key);
      }
    } else if (typeof value !== typeof template) fail();
  }
  if (draft.base) shape(draft.base, emptyValuationCaseDraft(), 'base');
  if (draft.advanced) shape(draft.advanced, advancedDraftFromValuationCase(null), 'advanced');
  if (draft.critical) shape(draft.critical, [emptyCriticalEvidenceRow()], 'critical');
  return draft;
}
function updateValuationEditorDraft(current, group, value) {
  if (!GROUPS.includes(group)) fail();
  return validateValuationEditorDraft({ ...(current || {}), version: VERSION, status: STATUS, [group]: value });
}
function copyValuationEditorDraft(draft) {
  return draft == null ? null : JSON.parse(JSON.stringify(validateValuationEditorDraft(draft)));
}
function rebaseValuationEditorDraft(current, appliedGroup, valuationCase) {
  if (!GROUPS.includes(appliedGroup)) fail();
  if (!current || !valuationCase) return null;
  const next = copyValuationEditorDraft(current);
  delete next[appliedGroup];
  if (!GROUPS.some(group => next[group] !== undefined)) return null;
  if (next.base) next.base.preservedAdvanced = draftFromValuationCase(valuationCase).preservedAdvanced;
  if (next.advanced) next.advanced.preservedEvidenceExtras = advancedDraftFromValuationCase(valuationCase).preservedEvidenceExtras;
  return validateValuationEditorDraft(next);
}
module.exports = { VERSION, STATUS, validateValuationEditorDraft, updateValuationEditorDraft, copyValuationEditorDraft, rebaseValuationEditorDraft };
