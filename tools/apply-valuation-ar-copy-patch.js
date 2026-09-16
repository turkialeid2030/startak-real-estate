'use strict';

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const panelPath = path.join(root, 'src/components/ValuationIntelligenceBasePanel.jsx');
const e2ePath = path.join(root, 'tests/e2e/run_full_e2e_ci.mjs');

function replaceRequired(source, before, after, label) {
  if (!source.includes(before)) throw new Error(`VALUATION_AR_COPY_PATCH_TARGET_MISSING:${label}`);
  return source.replace(before, after);
}

let panel = fs.readFileSync(panelPath, 'utf8');
const replacements = [
  ["legacyBody: 'لم يتم تفعيل Valuation V1 لهذه الحالة. تستمر نتائج الدراسة الحالية كما هي دون ترحيل أو افتراضات تلقائية.'", "legacyBody: 'لم يتم تفعيل طبقة التقييم — الإصدار الأول لهذه الحالة. تستمر نتائج الدراسة الحالية كما هي دون ترحيل أو افتراضات تلقائية.'", 'legacyBody'],
  ["configure: 'تهيئة Valuation V1'", "configure: 'تهيئة التقييم — الإصدار الأول'", 'configure'],
  ["disableConfirm: 'سيتم إلغاء تفعيل Valuation V1 للحالة الحالية فقط. لن يتم حذف نتائج المحرك الحالي. هل تريد المتابعة؟'", "disableConfirm: 'سيتم إلغاء تفعيل طبقة التقييم — الإصدار الأول للحالة الحالية فقط. لن يتم حذف نتائج المحرك الحالي. هل تريد المتابعة؟'", 'disableConfirm'],
  ["currencyPlaceholder: 'مثال: SAR'", "currencyPlaceholder: 'مثال: رمز العملة بالصيغة المعتمدة'", 'currencyPlaceholder'],
  ["projectPlaceholder: 'مثال: PROJECT-001'", "projectPlaceholder: 'مثال: مشروع-٠٠١'", 'projectPlaceholder'],
  ["legacyOnlyBadge: 'Legacy Only'", "legacyOnlyBadge: 'المسار الحالي فقط'", 'legacyOnlyBadge'],
  ["valuationV1Badge: 'Valuation V1'", "valuationV1Badge: 'التقييم — الإصدار الأول'", 'valuationV1Badge'],
];
for (const [before, after, label] of replacements) panel = replaceRequired(panel, before, after, label);

const toggleBefore = `        <button\n          type="button"\n          onClick={() => setExpanded((value) => !value)}\n          className="px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-1.5"`;
const toggleAfter = `        <button\n          type="button"\n          aria-label={expanded ? text.closeConfiguration : valuationCase ? text.editConfiguration : text.configure}\n          onClick={() => setExpanded((value) => !value)}\n          className="px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-1.5"`;
panel = replaceRequired(panel, toggleBefore, toggleAfter, 'configurationToggleAriaLabel');
fs.writeFileSync(panelPath, panel, 'utf8');

let e2e = fs.readFileSync(e2ePath, 'utf8');
e2e = replaceRequired(e2e, "page.getByText('تهيئة Valuation V1', { exact: true })", "page.getByText('تهيئة التقييم — الإصدار الأول', { exact: true })", 'e2eConfigureText');
e2e = replaceRequired(e2e, "page.getByRole('button', { name: 'تهيئة Valuation V1' })", "page.getByRole('button', { name: 'تهيئة التقييم — الإصدار الأول' })", 'e2eConfigureRoleCount');
e2e = replaceRequired(e2e, "page.getByRole('button', { name: 'تهيئة Valuation V1' }).click()", "page.getByRole('button', { name: 'تهيئة التقييم — الإصدار الأول' }).click()", 'e2eConfigureClick');
fs.writeFileSync(e2ePath, e2e, 'utf8');

console.log('VALUATION_AR_COPY_PATCH=APPLIED');
