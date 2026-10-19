'use strict';
const { calculateContractRunoff } = require('../residential-income-acquisition/contract-runoff');
// Compare accruals only on identical dated periods. Cash and CAPEX remain separate.
function reconcileOperatingFinancial(runoff, result, calendar) {
  const base = { version: 1, status: 'NOT_COMPARABLE', blockers: [], rows: [],
    aggregateEngineUpdated: false, transactionAuthorized: false, fullReconciliationEstablished: false };
  const first = calendar?.periods?.[0];
  if (!first || first.startDate !== runoff?.periodStart || first.endDateExclusive !== runoff?.periodEndExclusive)
    base.blockers.push('PERIOD_MISMATCH');
  const safe = n => typeof n === 'number' && Number.isFinite(n) && Number.isSafeInteger(Math.round(n * 100));
  const values = [runoff?.totals?.contractRent, runoff?.totals?.normalizedOpexBeforeReserve,
    result?.rentalIncomeAfterVacancy, result?.firstYearServiceIncome,
    result?.firstYearTotalAnnualIncome, result?.firstYearNOI, result?.replacementReserveAmount];
  if (!values.every(safe)) base.blockers.push('AMOUNTS_UNAVAILABLE');
  if(!safe(runoff?.totals?.normalizedReplacementReserve)||!safe(runoff?.totals?.normalizedOpex)
    || Math.abs(runoff.totals.normalizedOpex-runoff.totals.normalizedOpexBeforeReserve-runoff.totals.normalizedReplacementReserve)>.005)
    base.blockers.push('SOURCE_RESERVE_BREAKDOWN_REQUIRED');
  if (base.blockers.length) return base;
  const [rent, opex, modelRent, service, revenue, noi, reserve] = values;
  const modelOpex = revenue - noi - reserve;
  // Start at aggregate NOI after reserve; remove service/reserve basis differences
  // and replace aggregate rental/expense assumptions by dated contract accruals.
  const adjustments = [rent - modelRent, -service, modelOpex - opex, reserve];
  const bridged = adjustments.reduce((sum, value) => sum + value, noi);
  const target = rent - opex;
  const residual = target - bridged;
  if (![modelOpex, ...adjustments, bridged, target, residual].every(safe))
    return { ...base, blockers: ['AMOUNTS_UNAVAILABLE'] };
  return { ...base, status: Math.abs(residual) <= 0.005 ? 'ARITHMETIC_BRIDGE_COMPLETE' : 'BRIDGE_RESIDUAL',
    periodStart: first.startDate, periodEndExclusive: first.endDateExclusive,
    rows: [
      { code: 'MODEL_NOI', amount: noi },
      { code: 'RENT_DIFFERENCE', amount: adjustments[0] },
      { code: 'REMOVE_SERVICE', amount: adjustments[1] },
      { code: 'OPEX_DIFFERENCE', amount: adjustments[2] },
      { code: 'ADD_BACK_RESERVE', amount: adjustments[3] },
      { code: 'CONTRACT_NET', amount: target },
      { code: 'RESIDUAL', amount: residual },
    ],
    excluded: ['HISTORICAL_COLLECTIONS', 'CASH_FORECAST', 'CAPEX', 'FINANCING', 'TAX'],
    sourceReviewRequired: true };
}
function reconciliationHtml(bridge, locale = 'ar-SA') {
  if (!bridge) return '';
  const en = locale === 'en';
  const labels = {
    MODEL_NOI: ['صافي النموذج بعد الاحتياطي','Model NOI after reserve'],
    RENT_DIFFERENCE: ['فرق إيجار العقود عن إيجار النموذج','Contract less model rental income'],
    REMOVE_SERVICE: ['استبعاد دخل خدمات النموذج من أساس المقارنة','Remove model service income from comparison'],
    OPEX_DIFFERENCE: ['مصروف النموذج ناقص المصروف المعياري للعقود','Model expenses less normalized contract expenses'],
    ADD_BACK_RESERVE: ['إعادة الاحتياطي للوصول إلى أساس قبل الاحتياطي','Add back reserve for before-reserve basis'],
    CONTRACT_NET: ['صافي العقود قبل الاحتياطي والإنفاق الرأسمالي','Contract net before reserve and CAPEX'],
    RESIDUAL: ['فرق التسوية الحسابي','Arithmetic reconciliation residual'],
  };
  const title = en ? 'First-year accrual reconciliation' : 'تسوية الاستحقاق للسنة الأولى';
  if (bridge.status === 'NOT_COMPARABLE') return '<h2>'+title+'</h2><p>'+(en
    ? 'Comparison withheld: identical dated annual periods and complete amounts are required.'
    : 'تعذرت المقارنة: يلزم تطابق الفترة السنوية المؤرخة واكتمال القيم.')+'</p>';
  return '<h2>'+title+'</h2><p>'+(en
    ? 'Arithmetic bridge only; source validity and asset identity require review. Returns are unchanged. Cash, CAPEX, financing and tax are excluded.'
    : 'تسوية حسابية فقط؛ صحة المصادر وهوية الأصل تحتاج مراجعة. لم تتغير العوائد. التحصيل النقدي والإنفاق الرأسمالي والتمويل والضرائب خارج هذه التسوية.')+'</p><table><tbody>'
    + bridge.rows.map(row => '<tr><th>'+labels[row.code][en ? 1 : 0]+'</th><td>'+row.amount.toLocaleString(en ? 'en-US' : 'ar-SA', {maximumFractionDigits:2})+'</td></tr>').join('')+'</tbody></table>';
}
function reconcileOperatingHorizon(operatingCase, result, calendar) {
  const base = { version: 1, status: 'NOT_COMPARABLE', years: [],
    fullReconciliationEstablished: false, aggregateEngineUpdated: false, transactionAuthorized: false,
    renewalAssumed: false, normalizedExpenseGrowthAssumed: false };
  const periods = calendar?.periods, economics = result?.annualOperatingEconomics;
  if (!Array.isArray(periods) || !periods.length || periods.length > 50
    || !Array.isArray(economics) || economics.length !== periods.length
    || periods[0].startDate !== operatingCase?.asOfDate?.slice(0,10)) return base;
  const date = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;
  for (let i=0; i<periods.length; i++) {
    const p = periods[i];
    if (!date(p.startDate) || !date(p.endDateExclusive) || p.startDate >= p.endDateExclusive
      || p.year !== i+1 || economics[i].year !== i+1
      || (i && periods[i-1].endDateExclusive !== p.startDate)) return base;
    const anchor = new Date(periods[0].startDate), expected = new Date(periods[0].startDate);
    expected.setUTCDate(1); expected.setUTCFullYear(anchor.getUTCFullYear()+i+1);
    expected.setUTCDate(Math.min(anchor.getUTCDate(),new Date(Date.UTC(expected.getUTCFullYear(),anchor.getUTCMonth()+1,0)).getUTCDate()));
    if (p.endDateExclusive !== expected.toISOString().slice(0,10)) return base;
  }
  const years = periods.map((p,i) => {
    const runoff = calculateContractRunoff(operatingCase,{periodStart:p.startDate,periodEndExclusive:p.endDateExclusive});
    const e = economics[i];
    const bridge = reconcileOperatingFinancial(runoff,{
      rentalIncomeAfterVacancy:e.rental, firstYearServiceIncome:e.service,
      firstYearTotalAnnualIncome:e.revenue, firstYearNOI:e.NOI,
      replacementReserveAmount:e.replacementReserveAmount,
    },{periods:[p]});
    return {year:p.year,periodStart:p.startDate,periodEndExclusive:p.endDateExclusive,
      bridge, sourceIssues:runoff.issues, contractRent:runoff.totals?.contractRent ?? null,
      normalizedOpex:runoff.totals?.normalizedOpexBeforeReserve ?? null,
      sourceReplacementReserve:runoff.totals?.normalizedReplacementReserve ?? null,
      netBeforeReserveAndCapex:runoff.totals?.contractNetBeforeReserveAndCapex ?? null,
      scheduledCapex:runoff.totals?.scheduledCapex ?? null,
      netAfterScheduledCapexBeforeReserve:runoff.totals?.contractNetBeforeReserveAndCapex!=null&&runoff.totals?.scheduledCapex!=null
        ? runoff.totals.contractNetBeforeReserveAndCapex-runoff.totals.scheduledCapex : null,
      modelNoiAfterReserve:e.NOI,
      capexStatus:runoff.capitalPaymentPlan?.status ?? 'NOT_AVAILABLE'};
  });
  return {...base,status:years.every(y=>y.bridge.status==='ARITHMETIC_BRIDGE_COMPLETE')
    ? 'ARITHMETIC_HORIZON_COMPLETE' : 'PARTIAL',years};
}
function horizonReconciliationHtml(horizon, locale='ar-SA') {
  if (!horizon) return '';
  const en=locale==='en', w=(a,b)=>en?b:a;
  const escape=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=n=>typeof n==='number'&&Number.isFinite(n)?n.toLocaleString(en?'en-US':'ar-SA',{maximumFractionDigits:2}):w('غير متاح','Unavailable');
  const head='<h2>'+w('تسوية العقود على كامل مدة الدراسة','Contract reconciliation over the study horizon')+'</h2><p>'
    +w('المبالغ بالريال السعودي. تُستخدم العقود القائمة والمستقبلية المسجلة دون افتراض تجديد بعد انتهائها، وتبقى المصروفات المعيارية ثابتة وفق اللقطة. هذه مقارنة استحقاق وليست توقع تحصيل أو تقييمًا سوقيًا. الإنفاق الرأسمالي مستقل عن احتياطي الإحلال؛ لم تتغير عوائد النموذج المجمع.',
    'Amounts in SAR. Entered active/future leases run off without assumed renewals; normalized expenses remain flat per the source snapshot. This is an accrual comparison, not a collection forecast or market valuation. CAPEX is separate from the replacement reserve; aggregate returns are unchanged.')+'</p>';
  if(!horizon.years.length) return head+'<p>'+w('التسوية غير متاحة: تحقق من تطابق تاريخ الحالة وبداية الدراسة واكتمال السنوات والمدخلات.','Reconciliation unavailable: check case/study start alignment and complete annual inputs.')+'</p>';
  const table=(headers,rows)=>'<table><thead><tr>'+headers.map(h=>'<th>'+escape(h)+'</th>').join('')+'</tr></thead><tbody>'
    +rows.map(row=>'<tr>'+row.map(v=>'<td>'+escape(v)+'</td>').join('')+'</tr>').join('')+'</tbody></table>';
  return head+table([w('السنة','Year'),w('بداية الفترة','Period start'),w('النهاية غير المشمولة','Exclusive end'),w('حالة التسوية','Bridge status'),w('إيجار العقود','Contract rent'),w('المصروف دون الاحتياطي','OPEX before reserve')],horizon.years.map(y=>[y.year,y.periodStart,y.periodEndExclusive,
      y.bridge.status==='ARITHMETIC_BRIDGE_COMPLETE'?w('متسقة حسابيًا','Arithmetic match'):w('تحتاج استكمالًا','Incomplete'),
      money(y.contractRent),money(y.normalizedOpex)]))
    +table([w('السنة','Year'),w('احتياطي الحالة المسجل','Recorded source reserve'),w('الصافي قبل الاحتياطي والإنفاق','Net before reserve and CAPEX'),w('الإنفاق الرأسمالي','Scheduled CAPEX'),w('الصافي بعد الإنفاق وقبل الاحتياطي','Net after CAPEX before reserve'),w('صافي النموذج بعد الاحتياطي','Model NOI after reserve')],
      horizon.years.map(y=>[y.year,...['sourceReplacementReserve','netBeforeReserveAndCapex','scheduledCapex','netAfterScheduledCapexBeforeReserve','modelNoiAfterReserve'].map(k=>money(y[k]))]));
}
module.exports = { reconcileOperatingFinancial, reconciliationHtml, reconcileOperatingHorizon, horizonReconciliationHtml };
