#!/usr/bin/env python3
# Final deterministic cleanup for the decision-integrity successor candidate.
from pathlib import Path
import csv
import io

ROOT = Path(__file__).resolve().parents[1]


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected exactly one match, found {count}")
    return text.replace(old, new, 1)


# 1) Remove duplicate percentage-field registrations without changing semantics.
validation_path = ROOT / 'src/validation/numeric-safety.js'
v = validation_path.read_text(encoding='utf-8')
v = replace_once(
    v,
    "  'managementFeeRate', 'insuranceRateOnReplacementCost', 'maintenanceRate', 'insuranceRate',\n",
    "  'managementFeeRate', 'insuranceRateOnReplacementCost',\n",
    'percentage registry de-duplication',
)
validation_path.write_text(v, encoding='utf-8')

# 2) Remove the temporary MetricRow alias workaround and keep all dashboard rows
#    represented by the canonical MetricRow component. Also move the governed
#    assumption note fully into i18n.
app_path = ROOT / 'src/app/App.jsx'
a = app_path.read_text(encoding='utf-8')
a = replace_once(a, 'const AuditMetricRow = MetricRow;\n\n', '', 'AuditMetricRow alias removal')
a = a.replace('<AuditMetricRow ', '<MetricRow ')
if '<AuditMetricRow ' in a or 'AuditMetricRow' in a:
    raise RuntimeError('AuditMetricRow alias/reference remains after cleanup')
a = replace_once(
    a,
    'function LandInputPanel({ inputs, setInputs, assumptionModelVersion }) {\n  const { t, locale } = useLocale();\n  const patch = (key, value) => setInputs((prev) => ({ ...prev, [key]: value }));\n  const v2Governed = assumptionModelVersion === ASSUMPTION_MODEL_VERSION.V2;\n  const governedNote = v2Governed ? (locale === "en" ? "Governed by Assumption Model V2." : "محكوم بواسطة نموذج الافتراضات V2.") : null;',
    'function LandInputPanel({ inputs, setInputs, assumptionModelVersion }) {\n  const { t } = useLocale();\n  const patch = (key, value) => setInputs((prev) => ({ ...prev, [key]: value }));\n  const v2Governed = assumptionModelVersion === ASSUMPTION_MODEL_VERSION.V2;\n  const governedNote = v2Governed ? t("globalApp.governedAssumptionV2Note") : null;',
    'governed assumption note i18n',
)
app_path.write_text(a, encoding='utf-8')

# 3) Add localized governed-assumption note.
for locale, note in [
    ('en.js', 'Governed by Assumption Model V2.'),
    ('ar-SA.js', 'محكوم بواسطة نموذج الافتراضات V2.'),
]:
    p = ROOT / 'src/i18n/locales' / locale
    text = p.read_text(encoding='utf-8')
    if 'governedAssumptionV2Note:' not in text:
        anchor = '    genericWarnAbove: "Value above typical range — please verify",\n' if locale == 'en.js' else '    genericWarnAbove: "قيمة أعلى من المعتاد — تحقّق منها",\n'
        replacement = anchor + f'    governedAssumptionV2Note: "{note}",\n'
        text = replace_once(text, anchor, replacement, f'{locale} governed assumption translation')
    p.write_text(text, encoding='utf-8')

# 4) Register the 11 newly visible financial audit rows in the canonical R2B
#    MetricRow inventory instead of hiding them behind a component alias.
inventory_path = ROOT / 'I18N_R2B_METRICROW_INVENTORY.csv'
raw = inventory_path.read_text(encoding='utf-8-sig')
reader = csv.DictReader(io.StringIO(raw))
fieldnames = reader.fieldnames
rows = list(reader)
new_ids = {
    'MR-B38', 'MR-B39', 'MR-B40', 'MR-B41',
    'MR-L30', 'MR-L31', 'MR-L32', 'MR-L33', 'MR-L34', 'MR-L35', 'MR-L36',
}
rows = [row for row in rows if row['stable_id'] not in new_ids]

app_lines = a.splitlines()
def source_line(marker):
    matches = [i + 1 for i, line in enumerate(app_lines) if marker in line]
    if len(matches) != 1:
        raise RuntimeError(f'inventory marker {marker}: expected one line, found {len(matches)}')
    return str(matches[0])

def row(stable_id, marker, study, section, label, value_expr):
    return {
        'stable_id': stable_id,
        'source_file': 'App.jsx',
        'source_location': source_line(marker),
        'occurrence_type': 'JSX_CALL_SITE',
        'is_executable_call': 'TRUE',
        'study_type': study,
        'section': section,
        'r2b_wave': 'R2B-2',
        'label_current': label,
        'value_expression': value_expr,
        'formatter': 'formatRecommendationCurrency',
        'subtext': 'none',
        'financing_dependency': 'FALSE',
        'requires_translation': 'TRUE',
        'implementation_status': 'LOCALIZED_R2B2',
    }

new_rows = [
    row('MR-B38', 'metricRowR2B2.rentalIncomeFirstYear', 'building', 'income', 'الدخل التأجيري الفعلي — السنة الأولى', 'r.rentalIncomeAfterVacancy'),
    row('MR-B39', 'metricRowR2B2.serviceIncomeFirstYear', 'building', 'income', 'دخل الخدمات — السنة الأولى', 'r.firstYearServiceIncome'),
    row('MR-B40', 'metricRowR2B2.totalIncomeFirstYear', 'building', 'income', 'إجمالي الدخل — السنة الأولى', 'r.firstYearTotalAnnualIncome'),
    row('MR-B41', 'metricRowR2B2.firstYearNoiBuilding', 'building', 'opex', 'صافي الدخل التشغيلي — السنة الأولى', 'r.firstYearNOI'),
    row('MR-L30', 'metricRowR2B2.variableOperatingExpense', 'land', 'income', 'المصروف التشغيلي المتغير', 'r.variableOperatingExpense'),
    row('MR-L31', 'metricRowR2B2.fixedOperatingExpense', 'land', 'income', 'المصروف التشغيلي الثابت', 'r.fixedOperatingExpense'),
    row('MR-L32', 'metricRowR2B2.managementFeeAmount', 'land', 'income', 'رسوم الإدارة', 'r.managementFeeAmount'),
    row('MR-L33', 'metricRowR2B2.insuranceAmount', 'land', 'income', 'التأمين', 'r.insuranceAmount'),
    row('MR-L34', 'metricRowR2B2.operatingExpensesBeforeReserve', 'land', 'income', 'المصروفات التشغيلية قبل احتياطي الإحلال', 'r.operatingExpensesBeforeReserve'),
    row('MR-L35', 'metricRowR2B2.replacementReserveAmount', 'land', 'income', 'احتياطي الإحلال', 'r.replacementReserveAmount'),
    row('MR-L36', 'metricRowR2B2.firstOperatingYearNoi', 'land', 'income', 'صافي الدخل التشغيلي — أول سنة تشغيل', 'r.firstOperatingYearNOI'),
]
insert_at = next((i for i, r in enumerate(rows) if r['stable_id'] == 'MR-S01'), len(rows))
rows[insert_at:insert_at] = new_rows
out = io.StringIO()
writer = csv.DictWriter(out, fieldnames=fieldnames, lineterminator='\n')
writer.writeheader()
writer.writerows(rows)
inventory_path.write_text(out.getvalue(), encoding='utf-8')

# 5) Update inventory closure test to reflect the real dashboard inventory.
metric_test_path = ROOT / 'tests/i18n/run_metricrow_full_closure.js'
t = metric_test_path.read_text(encoding='utf-8')
replacements = [
    ('proves the 66 Dashboard', 'proves the 77 Dashboard'),
    ("check('INV-BUILDING-37', building.length === 37", "check('INV-BUILDING-41', building.length === 41"),
    ("check('INV-LAND-29', land.length === 29", "check('INV-LAND-36', land.length === 36"),
    ("check('INV-R2B2-30', localizedR2B2 === 30", "check('INV-R2B2-41', localizedR2B2 === 41"),
    ("check('INV-TOTAL-66', localizedR2B1 + localizedR2B2 + localizedR2B3 === 66", "check('INV-TOTAL-77', localizedR2B1 + localizedR2B2 + localizedR2B3 === 77"),
    ("check('SRC-67-TOTAL-CALLS', allMetricRowLines.length === 67", "check('SRC-78-TOTAL-CALLS', allMetricRowLines.length === 78"),
    ("check('SRC-66-DASHBOARD-CALLS', dashboardLines.length === 66", "check('SRC-77-DASHBOARD-CALLS', dashboardLines.length === 77"),
    ("R2B4_STABLE_IDS_TESTED=66", "R2B4_STABLE_IDS_TESTED=77"),
    ("DASHBOARD_METRICROW_ACCOUNTING=23+30+13=66", "DASHBOARD_METRICROW_ACCOUNTING=23+41+13=77"),
]
for old, new in replacements:
    if old not in t:
        raise RuntimeError(f'metric inventory test anchor not found: {old}')
    t = t.replace(old, new, 1)
metric_test_path.write_text(t, encoding='utf-8')

# 6) Extend targeted regression to guard the cleanup itself.
decision_test_path = ROOT / 'tests/defects/decision_integrity_wave.js'
d = decision_test_path.read_text(encoding='utf-8')
anchor = "assert.ok(!app.includes('onChange(isNaN(parsed) ? 0'), 'blank numeric input must not silently become zero');\n"
extra = anchor + "assert.ok(!app.includes('AuditMetricRow'), 'all dashboard audit rows must use canonical MetricRow');\nassert.ok(!app.includes('locale === \\\"en\\\" ? \\\"Governed by Assumption Model V2.'), 'governed assumption note must be localized through i18n');\nconst enLocale = require('../../src/i18n/locales/en.js');\nconst arLocale = require('../../src/i18n/locales/ar-SA.js');\nassert.ok(enLocale.globalApp.governedAssumptionV2Note && arLocale.globalApp.governedAssumptionV2Note, 'governed assumption note must exist in both locales');\nconst metricRowCalls = app.split('\\n').filter((line) => line.includes('<MetricRow')).length;\nassert.strictEqual(metricRowCalls, 78, 'canonical MetricRow source inventory must include 77 dashboard rows plus sensitivity');\n"
d = replace_once(d, anchor, extra, 'targeted cleanup regression')
decision_test_path.write_text(d, encoding='utf-8')

print('DECISION_INTEGRITY_FINAL_CLEANUP_APPLIED=1')
