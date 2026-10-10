'use strict';
const { sha256Hex } = require('../crypto/sha256');
const { calculateUiInvestmentState } = require('../assumptions/ui-integration-controller');
const { buildPersonalResearchReport, verifyPersonalResearchReport } = require('./personal-investment-research-report');
const { buildUserEnteredZakatLayer } = require('../zakat/user-entered-zakat');
const { paybackDisclosure } = require('./payback-disclosure');
const { describeDiagnostic } = require('../i18n/diagnostic-presentation');
const arLabels = require('../i18n/locales/ar-SA');
const enLabels = require('../i18n/locales/en');
const {validateRentalCalendar,rentalCalendarDisclosure}=require('./rental-calendar-disclosure');
const { validateInputProvenance,provenanceForInputs }=require('./input-provenance');
const { financialModelScope } = require('../project-model/asset-support');
const { BUILD_METADATA } = require('../runtime/build-metadata');
const VERSION = 'PERSONAL_FINANCIAL_STUDY_V2';
const finite = x => typeof x === 'number' && Number.isFinite(x) ? x : null;
function snapshot(value) {
  if (Array.isArray(value)) return value.map(snapshot);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k => [k, snapshot(value[k])]));
  return typeof value === 'number' && !Number.isFinite(value) ? null : value === undefined ? null : value;
}
const digest = value => sha256Hex(JSON.stringify(snapshot(value)));
function freeze(value) {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}
function evaluate(mode, inputs, assumptionModelVersion) {
  try {
    const state = calculateUiInvestmentState({ mode, inputs, assumptionModelVersion });
    return { status: state.results.financialModelStatus || 'CALCULATED', results: snapshot(state.results),
      governance: snapshot(state.governance || null), error: null };
  } catch (error) {
    const invalidInputs = error.name === 'ValidationError' || error.name === 'AssumptionModelError';
    return { status: invalidInputs ? 'INPUTS_INVALID' : 'COMPUTATION_FAILED', results: null, governance: null,
      error: { code: error.rule || error.code || error.reasonCode || (invalidInputs ? 'FINANCIAL_INPUTS_INVALID' : 'FINANCIAL_COMPUTATION_FAILED'),
        field: error.field || null, messageAr: error.message_ar || null, messageEn: error.message_en || null } };
  }
}
function summary(result) {
  const r = result || {};
  return { irr: finite(r.irr), npv: finite(r.npv), equityIrr: finite(r.leveredIRR),
    equityNpv: finite(r.leveredNPV), minimumDscr: finite(r.dscrMin),
    operatingPaybackYears: finite(r.cumulativePaybackOnCost ?? r.cumulativeProjectPaybackYears),
    decisionStatus: r.decisionStatus || null };
}
function experiment(mode, inputs, assumptionModelVersion, changes) {
  const changed = { ...inputs };
  const appliedChanges = changes.map(({ field, requested }) => {
    const effective = field === 'occupancyRate' ? Math.max(0, Math.min(1, requested)) : requested;
    changed[field] = effective;
    return { field, original: inputs[field], requested, effective, boundaryLimited: requested !== effective };
  });
  const calculated = evaluate(mode, changed, assumptionModelVersion);
  return { appliedChanges, status: calculated.status, metrics: summary(calculated.results), error: calculated.error };
}
function experiments(mode, inputs, assumptionModelVersion) {
  const rent = mode === 'building' ? 'rentPerSqm' : 'marketRentPerSqm';
  const fields = mode === 'building' ? [rent, 'buildingPrice', 'occupancyRate']
    : [rent, 'constructionCostPerSqm', 'landPricePerSqm'];
  const sensitivity = fields.filter(field => finite(inputs[field]) !== null).map(field => ({ field,
    low: experiment(mode, inputs, assumptionModelVersion, [{ field, requested: inputs[field] * 0.9 }]),
    high: experiment(mode, inputs, assumptionModelVersion, [{ field, requested: inputs[field] * 1.1 }]),
  }));
  const upside = finite(inputs[rent]) === null ? [] : [{ field: rent, requested: inputs[rent] * 1.1 }];
  const downside = finite(inputs[rent]) === null ? [] : [{ field: rent, requested: inputs[rent] * 0.9 }];
  if (finite(inputs.occupancyRate) !== null) downside.push({ field: 'occupancyRate', requested: inputs.occupancyRate - 0.1 });
  if (finite(inputs.exitCapRate) !== null) downside.push({ field: 'exitCapRate', requested: inputs.exitCapRate + 0.01 });
  if (mode === 'land') {
    if (finite(inputs.constructionCostPerSqm) !== null) downside.push({ field: 'constructionCostPerSqm', requested: inputs.constructionCostPerSqm * 1.1 });
    if (finite(inputs.constructionPeriod) !== null) downside.push({ field: 'constructionPeriod', requested: inputs.constructionPeriod + 1 });
  }
  return { scenarioKind: 'ILLUSTRATIVE_INPUT_STRESS_NOT_FORECAST_OR_PROBABILITY', sensitivity,
    scenarios: [
      { name: 'CURRENT_INPUTS', ...experiment(mode, inputs, assumptionModelVersion, []) },
      { name: 'RENT_UP_10_PERCENT', ...experiment(mode, inputs, assumptionModelVersion, upside) },
      { name: 'COMPOUND_DOWNSIDE', ...experiment(mode, inputs, assumptionModelVersion, downside) },
    ] };
}
function annualRows(mode, r, inputs) {
  if (!r || !Array.isArray(r.cashflows)) return [];
  const constructionYears = mode === 'land' ? r.constructionYears : 0;
  return r.cashflows.map((flow, year) => ({ year,
    operatingNoi: year === 0 ? null : year <= constructionYears ? 0 : finite(r.operatingNoiCashflows?.[year - constructionYears - 1]),
    unleveredCashflow: finite(flow),
    equityCashflow: inputs.leverageEnabled ? finite(r.leveredCashflows?.[year]) : null,
    includesTerminalSale: year === r.cashflows.length - 1 && (r.cashflowsIncludeTerminalValue === true || (mode === 'land' && finite(r.terminalNetExitValue) !== null)),
  }));
}
function zakat(mode, r, inputs, zakatCase) {
  if (!r || !Array.isArray(r.cashflows)) return { status: 'CASHFLOWS_UNAVAILABLE', layer: null };
  try {
    const levered = inputs.leverageEnabled === true;
    const before = levered ? r.leveredCashflows : r.cashflows;
    if (!Array.isArray(before)) return { status: 'CASHFLOWS_UNAVAILABLE', layer: null };
    const rate = levered ? r.equityDiscountRate : mode === 'building' ? inputs.discountRate : inputs.hurdleRate;
    const layer = buildUserEnteredZakatLayer({ mode, cashflowsBeforeZakat: before, zakatCase,
      constructionYears: mode === 'land' ? r.constructionYears : 0,
      operatingYears: mode === 'land' ? r.operatingYears : before.length - 1,
      discountRate: rate, returnsReady: r.exitDependentAnalyticsReady !== false });
    return { status: layer.status, cashflowBasis: levered ? 'EQUITY' : 'UNLEVERED', layer: snapshot(layer) };
  } catch (error) { return { status: 'ZAKAT_INPUTS_INVALID', layer: null, error: { code: error.code || error.name } }; }
}
function buildPersonalFinancialStudy({ mode, inputs, assumptionModelVersion, zakatCase = null,
  dealName = '', inputProvenance = null, rentalContext = null, valuationCase = null, runtime = null, valuationEditorDraft = null, generatedAt = new Date() } = {}) {
  if (!['building', 'land'].includes(mode) || !inputs || typeof inputs !== 'object' || Array.isArray(inputs)) throw new TypeError('PERSONAL_FINANCIAL_CONTEXT_INVALID');
  validateInputProvenance(inputProvenance);validateRentalCalendar(rentalContext);
  const calculated = evaluate(mode, inputs, assumptionModelVersion);
  const valuation = buildPersonalResearchReport({ valuationCase: mode === 'building' ? valuationCase : null,
    runtime: mode === 'building' && calculated.results ? runtime : null, generatedAt });
  const inputSnapshot = snapshot(inputs);
  const { reportHashSha256: _valuationHash, ...compatibleValuationFields } = valuation;
  const core = { ...compatibleValuationFields, version: VERSION,
    dealName: typeof dealName === 'string' ? dealName : '',
    currency: 'SAR', valuationReport: valuation,
    sourceBuild: snapshot(BUILD_METADATA),
    inputFingerprintSha256: digest({ mode, inputs: inputSnapshot, assumptionModelVersion, zakatCase, valuationCase, valuationEditorDraft,inputProvenance,rentalContext }),
    financial: { mode, currency: 'SAR', assumptionModelVersion,
      modelScope: financialModelScope(mode),
      rentalCalendar:rentalCalendarDisclosure({mode,inputs,result:calculated.results,context:rentalContext,asOfDate:generatedAt}),
      inputProvenance:provenanceForInputs(mode,inputs,inputProvenance),
      engineVersion: calculated.results?.financialModelVersion || null,
      status: calculated.status, inputs: inputSnapshot,
      results: calculated.results, governance: calculated.governance, error: calculated.error,
      payback: calculated.results ? paybackDisclosure(mode, calculated.results) : null,
      annualCashflows: annualRows(mode, calculated.results, inputs),
      experiments: calculated.results ? experiments(mode, inputs, assumptionModelVersion) : null,
      zakat: zakat(mode, calculated.results, inputs, zakatCase),
      usesPreviousValidResults: false,
    },
    valuationEditorDraft: snapshot(valuationEditorDraft),
  };
  return freeze({ ...core, reportHashSha256: digest(core) });
}
function verifyPersonalFinancialStudy(report) {
  if (!report || report.version !== VERSION || report.purpose !== 'PERSONAL_INVESTMENT_RESEARCH'
      || report.professionalAppraisalClaim !== false || report.transactionAuthorityClaim !== false
      || report.financial?.usesPreviousValidResults !== false
      || !verifyPersonalResearchReport(report.valuationReport)) return false;
  const { reportHashSha256, ...core } = report;
  return digest(core) === reportHashSha256;
}
function h(value) { return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function htmlFinancialStudy(report, { locale = 'ar-SA' } = {}) {
  if (!verifyPersonalFinancialStudy(report)) throw new Error('PERSONAL_FINANCIAL_DIGEST_INVALID');
  const ar = locale !== 'en', f = report.financial, r = f.results || {}, p = f.payback || {};
  const words = (a, e) => ar ? a : e;
  const number = value => finite(value) === null ? words('غير متاح', 'Unavailable') : value.toLocaleString(ar ? 'ar-SA' : 'en-US', { maximumFractionDigits: 2 });
  const money = value => finite(value) === null ? number(value) : number(value) + words(' ريال سعودي', ' SAR');
  const percent = value => finite(value) === null ? number(value) : number(value * 100) + '%';
  const rows = entries => '<table><tbody>' + entries.map(([label, value]) => '<tr><th>' + h(label) + '</th><td>' + h(value) + '</td></tr>').join('') + '</tbody></table>';
  const diagnostic = code => { const d = describeDiagnostic(code, locale); return h(d.message) + ' <code dir="ltr">' + h(d.code) + '</code>'; };
  const inputLabels = ar ? arLabels : enLabels;
  const aliases = { landLength: 'landLength', landWidth: 'landWidth' };
  const label = key => {
    const group = f.mode === 'building' ? inputLabels.inputBuilding : inputLabels.inputLand;
    const candidate = group?.[aliases[key] || key];
    return typeof candidate === 'string' ? candidate : key;
  };
  const inputRows = Object.entries(f.inputs).map(([key, value]) => [label(key) + ' [' + key + ']',
    value === null ? words('مفقود / غير متاح', 'Missing / unavailable') : typeof value === 'boolean' ? (value ? words('نعم','Yes') : words('لا','No')) : typeof value === 'object' ? JSON.stringify(value) : String(value)]);
  const firstNoi = f.mode === 'building' ? r.firstYearNOI : r.firstOperatingYearNOI;
  const expenses = f.mode === 'building' ? r.opexAmount : r.operatingExpenses;
  const metrics = [
    [words('إجمالي تكلفة الاستحواذ / المشروع', 'Total acquisition / project cost'), money(r.totalPurchaseCost ?? r.totalProjectCost)],
    [words('صافي الدخل التشغيلي المستقر قبل احتياطي الإحلال', 'Stabilized NOI before replacement reserve'), money(r.noiBeforeReserve)],
    [words('احتياطي الإحلال السنوي', 'Annual replacement reserve'), money(r.replacementReserveAmount)],
    [words('صافي الدخل التشغيلي المستقر بعد الاحتياطي', 'Stabilized NOI after reserve'), money(r.NOI ?? r.stabilizedNOI)],
    [words('صافي دخل أول سنة تشغيل', 'First operating-year NOI'), money(firstNoi)],
    [words('المصروفات التشغيلية مع احتياطي الإحلال', 'Operating expenses including replacement reserve'), money(expenses)],
    [words('معدل العائد الداخلي قبل التمويل', 'Unlevered IRR'), percent(r.irr)],
    [words('صافي القيمة الحالية قبل التمويل', 'Unlevered NPV'), money(r.npv)],
    [words('المعايير المحققة / إجمالي المعايير في نتيجة المحرك', 'Met / total criteria from the engine result'), Number.isInteger(r.metCount) && Number.isInteger(r.totalCriteria) ? r.metCount + ' / ' + r.totalCriteria : words('غير متاح', 'Unavailable')],
    [words('التمويل مفعّل', 'Financing enabled'), f.inputs.leverageEnabled ? words('نعم', 'Yes') : words('لا', 'No')],
    [words('مبلغ التمويل', 'Debt amount'), f.inputs.leverageEnabled ? money(r.loanAmount) : words('غير منطبق', 'Not applicable')],
    [words('خدمة الدين السنوية', 'Annual debt service'), f.inputs.leverageEnabled ? money(r.debtService) : words('غير منطبق', 'Not applicable')],
    [words('أدنى تغطية لخدمة الدين', 'Minimum DSCR'), f.inputs.leverageEnabled ? number(r.dscrMin) : words('غير منطبق', 'Not applicable')],
    [words('معدل العائد الداخلي لحقوق الملكية', 'Equity IRR'), f.inputs.leverageEnabled ? percent(r.leveredIRR) : words('غير منطبق', 'Not applicable')],
    [words('صافي القيمة الحالية لحقوق الملكية', 'Equity NPV'), f.inputs.leverageEnabled ? money(r.leveredNPV) : words('غير منطبق', 'Not applicable')],
  ];
  const annual = f.annualCashflows.map(row => '<tr><td>' + row.year + '</td><td>' + h(money(row.operatingNoi)) + '</td><td>' + h(money(row.unleveredCashflow)) + '</td><td>' + h(f.inputs.leverageEnabled ? money(row.equityCashflow) : words('غير منطبق', 'Not applicable')) + '</td><td>' + h(row.includesTerminalSale ? words('يشمل البيع في نهاية السنة', 'Includes end-of-year sale') : '') + '</td></tr>').join('');
  const changedValue = (field, value) => /Rate$/.test(field) ? percent(value) : number(value);
  const changesText = changes => changes.length ? changes.map(c => label(c.field) + ': ' + changedValue(c.field, c.original)
    + words(' ← ', ' → ') + changedValue(c.field, c.effective)
    + (c.boundaryLimited ? words(' (القيمة المطلوبة ', ' (requested ') + changedValue(c.field, c.requested) + words('؛ طُبّق الحد المسموح)', '; limited to allowed bound)') : '')).join(words('؛ ', '; ')) : words('دون تغيير', 'Unchanged');
  const sensitivity = (f.experiments?.sensitivity || []).map(item => '<tr><td>' + h(label(item.field)) + '</td><td>' + h(percent(item.low.metrics.irr)) + '</td><td>' + h(percent(item.high.metrics.irr)) + '</td><td>' + h(words('خفض: ', 'Decrease: ') + changesText(item.low.appliedChanges) + words(' | رفع: ', ' | Increase: ') + changesText(item.high.appliedChanges)) + '</td></tr>').join('');
  const scenarioNames = { CURRENT_INPUTS: words('المدخلات الحالية', 'Current inputs'), RENT_UP_10_PERCENT: words('اختبار ارتفاع الإيجار 10%', 'Rent +10% test'), COMPOUND_DOWNSIDE: words('اختبار ضغط مركب', 'Compound downside test') };
  const scenarios = (f.experiments?.scenarios || []).map(item => '<tr><td>' + h(scenarioNames[item.name]) + '</td><td>' + h(percent(item.metrics.irr)) + '</td><td>' + h(money(item.metrics.npv)) + '</td><td>' + h(changesText(item.appliedChanges)) + (item.error ? '<br>' + diagnostic(item.error.code) : '') + '</td></tr>').join('');
  const blockers = [...new Set([...(r.incompleteInputs || []), ...(r.failedHardGates || []), ...report.warnings])];
  const error = f.error ? '<p>' + h(ar ? f.error.messageAr : f.error.messageEn) + ' ' + diagnostic(f.error.code) + ' <code>' + h(f.error.field) + '</code></p>' : '';
  const stageRows = report.methods.map(m => '<tr><td>' + h(m.method) + '</td><td>' + diagnostic(m.state) + '</td><td>' + h(money(m.diagnosticValue)) + '</td></tr>').join('');
  const z = f.zakat.layer;
  const zakatRows = z ? rows([
    [words('الزكاة السنوية المدخلة', 'User-entered annual Zakat'), money(z.annualZakatAmount)],
    [words('مصدر مبلغ الزكاة', 'Zakat amount source'), z.annualZakatSource ?? words('لم يقدم', 'Not supplied')],
    [words('العائد الداخلي بعد الزكاة المدخلة', 'IRR after user-entered Zakat'), percent(z.afterZakatIRR)],
    [words('صافي القيمة الحالية بعد الزكاة المدخلة', 'NPV after user-entered Zakat'), money(z.afterZakatNPV)],
  ]) : '<p>' + diagnostic(f.zakat.status) + '</p>';
  return '<!doctype html><html lang="' + (ar ? 'ar' : 'en') + '" dir="' + (ar ? 'rtl' : 'ltr') + '"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src &#39;none&#39;; style-src &#39;unsafe-inline&#39;"><title>' + words('دراسة استثمار عقاري شخصية', 'Personal real estate investment study') + '</title><style>body{font-family:Tahoma,Arial,sans-serif;color:#162033;max-width:1100px;margin:2rem auto;padding:1rem}h1,h2{color:#18344a}table{border-collapse:collapse;width:100%;margin:1rem 0;font-size:12px}th,td{border:1px solid #bac4ce;padding:.55rem;text-align:start;vertical-align:top;overflow-wrap:anywhere}th{background:#edf1f5}code{font-size:10px;overflow-wrap:anywhere}p,li{line-height:1.7}thead{display:table-header-group;break-inside:avoid;break-after:avoid}h1,h2{break-after:avoid;page-break-after:avoid}@page{size:A4;margin:14mm}@media print{body{margin:0;padding:0}tr{break-inside:avoid}h2{break-after:avoid}}</style></head><body><h1>' + words('دراسة استثمار عقاري شخصية', 'Personal real estate investment study') + '</h1><p>' + h(report.dealName || f.inputs.projectTitle || '') + '</p><p>' + words('دراسة تحليلية شخصية أولية — غير معتمدة', 'Personal preliminary analytical study — not certified') + '</p>'
    + rows([[words('نوع الدراسة', 'Study type'), words(f.mode === 'building' ? 'مبنى قائم' : 'أرض وتطوير', f.mode)], [words('تاريخ إعداد الدراسة', 'Generated at'), report.generatedAt], [words('إصدار الافتراضات', 'Assumption version'), f.assumptionModelVersion], [words('إصدار المحرك المالي', 'Financial engine version'), f.engineVersion], [words('معرّف بناء المنصة', 'Platform build identifier'), report.sourceBuild.buildId], [words('نسخة الشيفرة المصدرية', 'Source commit'), report.sourceBuild.sourceCommit || words('غير مرتبط بنسخة متحقق منها', 'Unverified source binding')], [words('حالة الحساب', 'Calculation status'), f.status]])
    + '<p>' + words('حد النموذج: إيجار مجمع للمبنى أو تطوير عام للأرض؛ الفئات المتخصصة وبيانات السوق لم تُؤهل. لا تثبت هذه الدراسة صلاحية التراخيص أو العقود أو مؤشرات القيمة المهنية.', 'Model scope: aggregate building rent or general land development; specialist asset models and market inputs are not qualified. The study does not establish licences, contracts, or professional value authority.') + '</p>' + error + '<h2>' + words('الملخص المالي', 'Financial summary') + '</h2>' + rows(metrics)
    + '<h2>' + words('الاسترداد وأفق الدراسة', 'Recovery and study horizon') + '</h2>' + rows([
      [words('استرداد بسيط: تكلفة ÷ صافي دخل أول سنة تشغيل', 'Simple cost / first operating-year NOI'), number(p.simpleCostOverFirstOperatingNoiYears)],
      [words('استرداد تشغيلي تراكمي في أفق المحرك — يستبعد البيع', 'Engine cumulative operating recovery — excludes sale'), number(p.engineCumulativeOperatingYears)],
      [words('أفق الاسترداد التشغيلي للمحرك بالسنوات', 'Engine operating recovery horizon in years'), number(p.engineOperatingHorizonYears)],
      [words('مدة الدراسة بالسنوات', 'Study duration in years'), number(p.studyHorizonYears)],
      [words('استرداد تشغيلي خلال مدة الدراسة', 'Operating recovery within study'), p.cumulativeOperatingWithinStudyYears == null ? words('غير متحقق ضمن مدة الدراسة', 'Not recovered within study') : number(p.cumulativeOperatingWithinStudyYears)],
      [words('استرداد مع البيع بنهاية السنة', 'Recovery including end-of-year sale'), number(p.cumulativeWithTerminalSaleYears)],
    ]) + '<p>' + words('الامتداد التشغيلي بعد مدة الدراسة افتراض نموذجي، ولا يثبت وجود عقود تغطي ذلك الامتداد. الاسترداد مع البيع يستخدم توقيت البيع في نهاية السنة.', 'Operating projections beyond the study are not proof of covering leases. Recovery relying on sale uses the actual end-of-year sale timing.') + '</p>'
    + '<h2>' + words('التدفقات السنوية', 'Annual cashflows') + '</h2><table><thead><tr><th>' + words('السنة', 'Year') + '</th><th>' + words('الدخل التشغيلي', 'Operating NOI') + '</th><th>' + words('التدفق قبل التمويل', 'Unlevered flow') + '</th><th>' + words('تدفق حقوق الملكية', 'Equity flow') + '</th><th>' + words('التخارج', 'Exit') + '</th></tr></thead><tbody>' + annual + '</tbody></table>'
    + '<h2>' + words('الزكاة المدخلة وأثرها', 'User-entered Zakat effect') + '</h2>' + zakatRows
    + '<h2>' + words('الحساسية: تغيير مدخل واحد ±10%', 'Sensitivity: one input ±10%') + '</h2><table><thead><tr><th>' + words('المدخل', 'Input') + '</th><th>' + words('العائد عند الخفض', 'IRR at decrease') + '</th><th>' + words('العائد عند الرفع', 'IRR at increase') + '</th><th>' + words('التغييرات وحدود التطبيق', 'Changes and boundaries') + '</th></tr></thead><tbody>' + sensitivity + '</tbody></table>'
    + '<h2>' + words('سيناريوهات اختبار افتراضية', 'Illustrative stress scenarios') + '</h2><p>' + words('اختبارات مدخلات معلنة وليست توقعات أو احتمالات. تعكس كل نتيجة القيم الفعلية المطبقة بعد حدود الإشغال.', 'Explicit input tests, not forecasts or probabilities. Each result uses the effective values after occupancy bounds.') + '</p><table><thead><tr><th>' + words('السيناريو', 'Scenario') + '</th><th>' + words('العائد الداخلي', 'IRR') + '</th><th>' + words('صافي القيمة الحالية', 'NPV') + '</th><th>' + words('الافتراضات المطبقة', 'Applied assumptions') + '</th></tr></thead><tbody>' + scenarios + '</tbody></table>'
    + '<h2>' + words('المدخلات الأصلية', 'Original inputs') + '</h2><p>' + words('القيم أدخلها المستخدم أو جاءت من نموذج الافتراضات المحدد. لا تثبت بذاتها أسعار السوق أو صحة مستند.', 'Values are user supplied or from the stated assumption model. They do not independently verify market prices or documents.') + '</p>' + rows(inputRows)
    + '<h2>' + words('فترات الدراسة ومراجعة نمو الإيجار','Calendar periods and rent-growth review') + '</h2><p>' + diagnostic(f.rentalCalendar?.status||'REGULATORY_CONTEXT_MISSING') + '</p>' + rows((f.rentalCalendar?.periods||[]).map(period=>[String(period.year),period.startDate+' — '+period.endDateExclusive+' · '+describeDiagnostic(period.status,locale).message])) + '<p>' + words('النهاية التقويمية المعروضة احتساب ميلادي إرشادي لخمس سنوات يحتاج تأكيدًا قانونيًا. مراجع العقود والاعتراض لا تثبت قبولها دون تحقق مستقل. نتائج الحساب افتراضية ولا تُعد اعتمادًا لتطبيق الأنظمة.','The displayed end is an illustrative five-year Gregorian projection requiring legal confirmation. Contract and objection references require independent verification. Financial results remain illustrative and do not certify regulatory applicability.') + '</p>'
    + '<h2>' + words('مصادر المدخلات وحالة مراجعتها','Input provenance and review status') + '</h2>' + rows(Object.values(f.inputProvenance||{}).map(entry=>[label(entry.field)+' ['+entry.field+']', [entry.unit,entry.sourceReference,entry.sourceDate,entry.location,describeDiagnostic(entry.status,locale).message+' ['+entry.status+']'].filter(Boolean).join(' · ')]))
    + '<h2>' + words('مؤشرات التقييم الإضافية', 'Additional valuation indications') + '</h2><table><thead><tr><th>' + words('المنهج', 'Method') + '</th><th>' + words('الحالة', 'Status') + '</th><th>' + words('مؤشر القيمة', 'Value') + '</th></tr></thead><tbody>' + stageRows + '</tbody></table>'
    + '<h2>' + words('أسباب عدم الإتاحة وملاحظات الأدلة', 'Unavailable results and evidence notes') + '</h2><ul>' + blockers.map(code => '<li>' + diagnostic(code) + '</li>').join('') + '</ul>'
    + '<p><small>' + words('بصمة المدخلات', 'Input fingerprint') + ': <code>' + report.inputFingerprintSha256 + '</code><br>' + words('بصمة التقرير', 'Report fingerprint') + ': <code>' + report.reportHashSha256 + '</code></small></p></body></html>';
}
module.exports = { VERSION, buildPersonalFinancialStudy, verifyPersonalFinancialStudy, htmlFinancialStudy, snapshot, digest };
