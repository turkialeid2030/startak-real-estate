from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly one match, found {count}')
    return text.replace(old, new, 1)


app_path = Path('src/app/App.jsx')
text = app_path.read_text(encoding='utf-8')

# 1) Wire the governed exit-transaction-cost parser into the production App.
text = replace_once(
    text,
    "  calculateUiInvestmentState,\n  applyExitCapInputText,\n  buildUiDisclosureViewModel,",
    "  calculateUiInvestmentState,\n  applyExitCapInputText,\n  applyExitTransactionCostInputText,\n  buildUiDisclosureViewModel,",
    'controller import',
)

# 2) Keep a legacy/reference dataset value for compatibility only. Fresh V2
# workspaces explicitly delete this value in createUiWorkspace(), so it can never
# become a silent V2 deal assumption.
text = replace_once(
    text,
    "  exitCapRate: 0.07,\n  marketCapRate: 0.07, discountRate: 0.08, holdPeriod: 5, rentGrowthRate: 0,",
    "  exitCapRate: 0.07,\n  exitTransferFeeRate: 0.05,\n  marketCapRate: 0.07, discountRate: 0.08, holdPeriod: 5, rentGrowthRate: 0,",
    'legacy default exit cost',
)

# 3) Make OptionalPercentField reusable for both exit cap and exit cost without
# misleading error text.
text = replace_once(
    text,
    "function OptionalPercentField({ label, note, value, onCommit, min = 0, max = 1 }) {",
    "function OptionalPercentField({ label, note, value, onCommit, min = 0, max = 1, invalidMessage = null }) {",
    'optional percent signature',
)
text = replace_once(
    text,
    "        warning={error ? (locale === 'en' ? 'Enter a valid explicit exit cap within the permitted range.' : 'أدخل معدل خروج صريحاً وصحيحاً ضمن النطاق المسموح.') : null}",
    "        warning={error ? (invalidMessage || (locale === 'en' ? 'Enter a valid explicit percentage within the permitted range.' : 'أدخل نسبة صريحة وصحيحة ضمن النطاق المسموح.')) : null}",
    'optional percent error copy',
)

# 4) Surface both governed sources/notices in the assumption banner.
text = replace_once(
    text,
    "        <span className=\"text-[10px] rf-num\" style={{ color: COLORS.slate }}>{disclosure.exitCapSource || '—'}</span>\n        {disclosure.legacyCompatibility ? <span className=\"text-[10px]\" style={{ color: COLORS.caution }}>LEGACY</span> : null}\n      </div>\n      {disclosure.exitCapNotice ? <div className=\"text-[11px] mt-1 leading-relaxed\" style={{ color: hold ? COLORS.caution : COLORS.slate }}>{disclosure.exitCapNotice}</div> : null}",
    "        <span className=\"text-[10px] rf-num\" style={{ color: COLORS.slate }}>{disclosure.exitCapSource || '—'}</span>\n        <span className=\"text-[10px] rf-num\" style={{ color: COLORS.slate }}>{disclosure.exitTransactionCostSource || '—'}</span>\n        {disclosure.legacyCompatibility ? <span className=\"text-[10px]\" style={{ color: COLORS.caution }}>LEGACY</span> : null}\n      </div>\n      {disclosure.exitCapNotice ? <div className=\"text-[11px] mt-1 leading-relaxed\" style={{ color: hold ? COLORS.caution : COLORS.slate }}>{disclosure.exitCapNotice}</div> : null}\n      {disclosure.exitTransactionCostNotice ? <div className=\"text-[11px] mt-1 leading-relaxed\" style={{ color: hold ? COLORS.caution : COLORS.slate }}>{disclosure.exitTransactionCostNotice}</div> : null}",
    'assumption disclosure banner',
)

# 5) Add the dedicated V2 exit-cost field next to exit-cap assumptions.
text = replace_once(
    text,
    "function BuildingInputPanel({ inputs, setInputs, assumptionModelVersion, onExitCapTextCommit }) {",
    "function BuildingInputPanel({ inputs, setInputs, assumptionModelVersion, onExitCapTextCommit, onExitTransactionCostTextCommit }) {",
    'building panel signature',
)
text = replace_once(
    text,
    "        <OptionalPercentField label={t(\"inputBuilding.exitCapRate\")} note={t(\"inputBuilding.exitCapRateNote\")} value={inputs.exitCapRate} onCommit={onExitCapTextCommit} min={0.04} max={0.14} />\n        <PercentField label={t(\"inputBuilding.discountRate\")}",
    "        <OptionalPercentField label={t(\"inputBuilding.exitCapRate\")} note={t(\"inputBuilding.exitCapRateNote\")} value={inputs.exitCapRate} onCommit={onExitCapTextCommit} min={0.04} max={0.14} />\n        <OptionalPercentField\n          label={locale === 'en' ? 'Seller-borne exit transaction cost' : 'تكلفة معاملة الخروج المحمّلة اقتصاديًا على البائع'}\n          note={locale === 'en'\n            ? 'Deal-specific economic assumption deducted from exit proceeds. This does not determine the statutory RETT taxpayer or any exemption.'\n            : 'افتراض اقتصادي خاص بالصفقة يُخصم من متحصلات الخروج. لا يحدد هذا الحقل المكلف النظامي بضريبة التصرفات العقارية ولا يقرر وجود إعفاء.'}\n          value={inputs.exitTransferFeeRate}\n          onCommit={onExitTransactionCostTextCommit}\n          min={0}\n          max={1}\n          invalidMessage={locale === 'en' ? 'Enter a valid seller-borne exit transaction-cost percentage from 0% to 100%.' : 'أدخل نسبة صحيحة لتكلفة معاملة الخروج التي يتحملها البائع اقتصاديًا من 0% إلى 100%.'}\n        />\n        <PercentField label={t(\"inputBuilding.discountRate\")}",
    'building exit cost field',
)

# 6) Wire the commit handler into App state. Invalid nonblank drafts are retained
# as invalid current-state values by the governed controller (fail-closed).
text = replace_once(
    text,
    "                onExitCapTextCommit={(rawText) => {\n                  try {\n                    const next = applyExitCapInputText({ inputs: buildingInputs, rawText, min: 0.04, max: 0.14 });\n                    setBuildingInputs(next.inputs);\n                    return { ok: true, displayValue: next.displayValue };\n                  } catch (error) {\n                    return { ok: false, code: error && error.code ? error.code : 'OPTIONAL_PERCENT_INVALID' };\n                  }\n                }}\n              />",
    "                onExitCapTextCommit={(rawText) => {\n                  try {\n                    const next = applyExitCapInputText({ inputs: buildingInputs, rawText, min: 0.04, max: 0.14 });\n                    setBuildingInputs(next.inputs);\n                    return { ok: next.inputValid !== false, displayValue: next.displayValue, code: next.errorCode };\n                  } catch (error) {\n                    return { ok: false, code: error && error.code ? error.code : 'OPTIONAL_PERCENT_INVALID' };\n                  }\n                }}\n                onExitTransactionCostTextCommit={(rawText) => {\n                  try {\n                    const next = applyExitTransactionCostInputText({ inputs: buildingInputs, rawText, min: 0, max: 1 });\n                    setBuildingInputs(next.inputs);\n                    return { ok: next.inputValid !== false, displayValue: next.displayValue, code: next.errorCode };\n                  } catch (error) {\n                    return { ok: false, code: error && error.code ? error.code : 'OPTIONAL_PERCENT_INVALID' };\n                  }\n                }}\n              />",
    'building input handlers',
)

# 7) When sensitivity is held, explain every unresolved exit dependency, not only
# exit cap.
text = replace_once(
    text,
    "              unavailableMessage={assumptionDisclosure ? assumptionDisclosure.exitCapNotice : null}",
    "              unavailableMessage={assumptionDisclosure ? [assumptionDisclosure.exitCapNotice, assumptionDisclosure.exitTransactionCostNotice].filter(Boolean).join(' ') : null}",
    'sensitivity hold copy',
)

app_path.write_text(text, encoding='utf-8')

# 8) Update core runtime E2E to enter both governed V2 exit assumptions.
e2e_path = Path('tests/e2e/run_runtime_e2e_ci.mjs')
e2e = e2e_path.read_text(encoding='utf-8')
e2e = replace_once(
    e2e,
    "async function enterExplicitBuildingExitCap(page, value = '8.5') {",
    "async function enterExplicitBuildingExitCap(page, value = '8.5') {",
    'e2e exit-cap helper anchor',
)
helper_anchor = "  return exitCap;\n}\n\ntry {"
helper_new = "  return exitCap;\n}\n\nasync function enterExplicitBuildingExitTransactionCost(page, value = '5') {\n  const sectionButton = page.getByRole('button', { name: /افتراضات التقييم والاستثمار/ }).first();\n  const section = sectionButton.locator('xpath=ancestor::div[contains(@class,\"rounded-2xl\") and contains(@class,\"overflow-hidden\")][1]');\n  const sectionBody = section.locator('.rf-accordion-body').first();\n  if (!((await sectionBody.getAttribute('class')) || '').split(/\\s+/).includes('open')) {\n    await sectionButton.click();\n    await page.waitForTimeout(200);\n  }\n  const exitCost = page\n    .getByText('تكلفة معاملة الخروج المحمّلة اقتصاديًا على البائع', { exact: true })\n    .locator('xpath=ancestor::label[1]')\n    .locator('input')\n    .first();\n  await exitCost.fill(value);\n  await exitCost.blur();\n  await page.waitForTimeout(300);\n  return exitCost;\n}\n\ntry {"
e2e = replace_once(e2e, helper_anchor, helper_new, 'e2e exit cost helper')
e2e = replace_once(
    e2e,
    "  const exitCapB = await enterExplicitBuildingExitCap(page, '8.5');\n  const bodyAfterB = await page.locator('body').innerText();",
    "  const exitCapB = await enterExplicitBuildingExitCap(page, '8.5');\n  const exitCostB = await enterExplicitBuildingExitTransactionCost(page, '5');\n  const bodyAfterB = await page.locator('body').innerText();",
    'e2e building setup',
)
e2e = replace_once(
    e2e,
    "      && (await exitCapB.inputValue()) === '8.5'\n      && bodyAfterB !== bodyBeforeB",
    "      && (await exitCapB.inputValue()) === '8.5'\n      && (await exitCostB.inputValue()) === '5'\n      && bodyAfterB !== bodyBeforeB",
    'e2e building assertion',
)
e2e = replace_once(
    e2e,
    "    `exitCap=${await exitCapB.inputValue()} safeVerdict=${SAFE_ANALYTICAL_VERDICT_RE.test(bodyAfterB)} legacyVerdict=${LEGACY_INVESTMENT_VERDICT_RE.test(bodyAfterB)}`",
    "    `exitCap=${await exitCapB.inputValue()} exitCost=${await exitCostB.inputValue()} safeVerdict=${SAFE_ANALYTICAL_VERDICT_RE.test(bodyAfterB)} legacyVerdict=${LEGACY_INVESTMENT_VERDICT_RE.test(bodyAfterB)}`",
    'e2e building detail',
)
e2e_path.write_text(e2e, encoding='utf-8')

print('P22_APP_AND_CORE_E2E_PATCH=APPLIED')
