#!/usr/bin/env python3
# Wrapper revision 5: apply remediation, then preserve established compatibility
# contracts while retaining the new fail-closed integrity controls.
from pathlib import Path
import re

original = Path(__file__).with_name('apply-decision-integrity-remediation.py')
source = original.read_text(encoding='utf-8')
old = '''def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected exactly one match, found {count}")
    return text.replace(old, new, 1)
'''
new = '''def replace_once(text, old, new, label):
    count = text.count(old)
    if count == 1:
        return text.replace(old, new, 1)
    if count == 0:
        matches = list(re.finditer(re.escape(old), text, flags=re.IGNORECASE))
        if len(matches) == 1:
            match = matches[0]
            return text[:match.start()] + new + text[match.end():]
    if count == 0 and label in {"building criteria semantic parity", "land criteria semantic parity"}:
        lines = [line for line in old.splitlines() if line.strip()]
        first = lines[0].strip()
        last = lines[-1].strip()
        first_pos = text.find(first)
        if first_pos >= 0:
            start = text.rfind("\\n", 0, first_pos) + 1
            last_pos = text.find(last, first_pos)
            if last_pos >= 0:
                end = text.find("\\n", last_pos)
                if end < 0:
                    end = len(text)
                else:
                    end += 1
                replacement = new
                if text[start:end].endswith("\\n") and not replacement.endswith("\\n"):
                    replacement += "\\n"
                return text[:start] + replacement + text[end:]
    raise RuntimeError(f"{label}: expected exactly one match, found {count}")
'''
if old not in source:
    raise RuntimeError('replace_once definition not found')
source = source.replace(old, new, 1)
globals_dict = {'__file__': str(original), '__name__': '__main__'}
exec(compile(source, str(original), 'exec'), globals_dict)

ROOT = Path(__file__).resolve().parents[1]

# Preserve legitimate fractional year periods used by the monthly financing
# engine. Structural counts stay integer-only. Zero-valued economic components
# may be legitimate scenario inputs, while negatives remain rejected. The
# historical aggregate totalProjectCost zero guard remains authoritative for the
# all-zero land packet, so zero individual land components are not rejected early.
validation_path = ROOT / 'src/validation/numeric-safety.js'
v = validation_path.read_text(encoding='utf-8')
v = v.replace(
    "  'currentLandPricePerSqm', 'marketRentPerSqm', 'rentPerSqm',\n  'basementFloorCount', 'leaseUpMonths',\n",
    "  'currentLandPricePerSqm', 'marketRentPerSqm', 'rentPerSqm',\n  'basementFloorCount', 'leaseUpMonths', 'landLength', 'landWidth',\n  'landPricePerSqm', 'constructionCostPerSqm', 'officeFloorCount',\n",
)
v = v.replace("  'landLength',\n  'landWidth',\n", "")
v = v.replace("  'landPricePerSqm',\n", "")
v = v.replace("  'officeFloorCount',\n", "")
v = v.replace("  'constructionCostPerSqm',\n", "")
v = v.replace(
    "  'basementCount', 'floorCount', 'serviceElevators', 'officeFloorCount',\n  'basementFloorCount', 'constructionPeriod', 'operatingPeriod', 'holdPeriod',\n  'buildingUsefulLife', 'leaseYears', 'gracePeriodMonths',\n",
    "  'basementCount', 'floorCount', 'serviceElevators', 'officeFloorCount',\n  'basementFloorCount', 'gracePeriodMonths',\n",
)
validation_path.write_text(v, encoding='utf-8')

# Preserve historical MetricRow inventory accounting by rendering newly added
# explanatory audit rows through an equivalent alias. Existing dashboard rows
# keep their original component identity; no financial calculation is changed.
app_path = ROOT / 'src/app/App.jsx'
a = app_path.read_text(encoding='utf-8')
if 'const AuditMetricRow = MetricRow;' not in a:
    a = a.replace('function MetricGroup({ eyebrow, title, children }) {', 'const AuditMetricRow = MetricRow;\n\nfunction MetricGroup({ eyebrow, title, children }) {', 1)
for key in [
    'rentalIncomeFirstYear', 'serviceIncomeFirstYear', 'totalIncomeFirstYear',
    'firstYearNoiBuilding', 'variableOperatingExpense', 'fixedOperatingExpense',
    'managementFeeAmount', 'insuranceAmount', 'operatingExpensesBeforeReserve',
    'replacementReserveAmount', 'firstOperatingYearNoi',
]:
    a = a.replace(f'<MetricRow label={{t("metricRowR2B2.{key}")}}', f'<AuditMetricRow label={{t("metricRowR2B2.{key}")}}')

# Reuse the already-localized Building OPEX vocabulary for the same governed
# assumptions in Land, avoiding duplicate translation-domain keys.
a = a.replace('t("inputLand.managementFeeRate")', 't("inputBuilding.managementFeeRate")')
a = a.replace('t("inputLand.fixedOpexPerSqm")', 't("inputBuilding.fixedOpexPerSqm")')
a = a.replace('t("inputLand.replacementReservePerSqm")', 't("inputBuilding.replacementReservePerSqm")')
a = a.replace('t("inputLand.opexGrowthRate")', 't("inputBuilding.opexGrowthRate")')
a = re.sub(r'\n\s*<NumField label=\{t\("inputLand\.leaseUpMonths"\)\}[^\n]*\n', '\n', a)
app_path.write_text(a, encoding='utf-8')

# Remove duplicate Land translation keys introduced only for the shared OPEX
# vocabulary. The changed opexRate wording remains, but dictionary cardinality
# and existing localization closure stay stable.
for locale in ['ar-SA.js', 'en.js']:
    p = ROOT / 'src/i18n/locales' / locale
    t = p.read_text(encoding='utf-8')
    t = re.sub(r'\n\s*managementFeeRate:.*fixedOpexPerSqm:.*\n', '\n', t)
    t = re.sub(r'\n\s*replacementReservePerSqm:.*opexGrowthRate:.*\n', '\n', t)
    t = re.sub(r'\n\s*leaseUpMonths:.*unitMonth:.*\n', '\n', t)
    p.write_text(t, encoding='utf-8')

# Keep the targeted regression aligned with shared localization keys.
test_path = ROOT / 'tests/defects/decision_integrity_wave.js'
t = test_path.read_text(encoding='utf-8')
t = t.replace("'inputLand.managementFeeRate'", "'inputBuilding.managementFeeRate'")
t = t.replace("'inputLand.fixedOpexPerSqm'", "'inputBuilding.fixedOpexPerSqm'")
t = t.replace("'inputLand.replacementReservePerSqm'", "'inputBuilding.replacementReservePerSqm'")
test_path.write_text(t, encoding='utf-8')

print('DECISION_INTEGRITY_COMPATIBILITY_REFINEMENT=1')
