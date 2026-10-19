'use strict';
const { validDate } = require('./cash-horizon');
const { xnpv, solveDatedXirr } = require('../valuation-intelligence/dated-returns');
const {parseLedgerAmount}=require('./receivables-ledger');
const {parseNumericText}=require('../validation/numeric-text');
const fail = code => { throw new TypeError(code); };
const text = v => typeof v === 'string' && v.trim() && v.length <= 500;
function validateInvestmentReturnContext(context, start, end) {
  if (!validDate(start) || !validDate(end) || end <= start) fail('CASH_RETURN_CONTEXT_INVALID');
  if (!context || context.schemaVersion !== 1 || !Number.isSafeInteger(context.acquisitionMinor) || context.acquisitionMinor <= 0
    || !['EXPLICIT_SALE','NO_SALE_INCLUDED'].includes(context.exitTreatment)) fail('CASH_RETURN_CONTEXT_INVALID');
  for (const key of ['acquisitionSourceRef','discountSourceRef','reviewRef']) if (!text(context[key])) fail('CASH_RETURN_REFERENCE_REQUIRED');
  if ([context.acquisitionSourceRef,context.discountSourceRef].some(ref => ref.trim() === context.reviewRef.trim())) fail('CASH_RETURN_REFERENCE_REQUIRED');
  if (typeof context.discountRate !== 'number' || !Number.isFinite(context.discountRate) || context.discountRate <= -1) fail('CASH_RETURN_RATE_INVALID');
  if (context.exitTreatment === 'EXPLICIT_SALE') {
    if (!validDate(context.saleDate) || context.saleDate <= start || context.saleDate >= end
      || !Number.isSafeInteger(context.netSaleMinor) || context.netSaleMinor <= 0) fail('CASH_RETURN_SALE_INVALID');
    if (!text(context.saleSourceRef) || context.saleSourceRef.trim() === context.reviewRef.trim()) fail('CASH_RETURN_REFERENCE_REQUIRED');
  } else if (context.saleDate != null || context.netSaleMinor != null || context.saleSourceRef != null) fail('CASH_RETURN_CONTEXT_INVALID');
  return { schemaVersion:1, acquisitionMinor:context.acquisitionMinor,
    acquisitionSourceRef:context.acquisitionSourceRef.trim(), discountRate:context.discountRate,
    discountSourceRef:context.discountSourceRef.trim(), reviewRef:context.reviewRef.trim(), exitTreatment:context.exitTreatment,
    ...(context.exitTreatment === 'EXPLICIT_SALE' ? { saleDate:context.saleDate, netSaleMinor:context.netSaleMinor, saleSourceRef:context.saleSourceRef.trim() } : {}) };
}
function calculateEnteredInvestmentReturns(c, plan, start, end, cashReady, otherCoverage) {
  const base = { version:1, status:'NOT_PROVIDED', blockers:[], flows:[], npvSar:null, xirr:null, xirrDiagnostics:null,
    caseId:c.caseId,periodStart:start,periodEndExclusive:end,
    basis:'UNLEVERED_ENTERED_PROPERTY_CASHFLOWS', dayCount:'ACT/365.2425',
    coverageComplete:false, sourceIndependentlyVerified:false, aggregateEngineUpdated:false, transactionAuthorized:false,
    excluded:['OPENING_BALANCE','HISTORICAL_COLLECTIONS','CONTRACT_ACCRUALS','NORMALIZED_OPEX','REPLACEMENT_RESERVE','FINANCING','DEPOSIT'] };
  if (!plan.investmentReturnContext) return base;
  const context = validateInvestmentReturnContext(plan.investmentReturnContext,start,end);
  const reserveIds=new Set((c.operatingExpenses||[]).filter(e=>e.category==='REPLACEMENT_RESERVE').map(e=>e.expenseId));
  const operatingEntries=(c.operatingPaymentPlan?.entries||[]).filter(e=>!reserveIds.has(e.expenseId));
  const blockers = [];
  if (!cashReady) blockers.push('CASH_RETURN_MATCHED_PLANS_REQUIRED');
  if (otherCoverage?.status !== 'REVIEW_DECLARED') blockers.push('CASH_RETURN_CATEGORY_REVIEW_REQUIRED');
  if (plan.otherFlows?.entries.some(e => e.category === 'OTHER')) blockers.push('CASH_RETURN_OTHER_FLOW_CLASSIFICATION_REQUIRED');
  if (context.exitTreatment === 'EXPLICIT_SALE' && [
    ...plan.entries, ...operatingEntries, ...(c.capitalPaymentPlan?.entries || []),
    ...(plan.otherFlows?.entries || []).filter(e => ['TAX','FEES','OTHER'].includes(e.category)),
  ].some(e => e.date > context.saleDate)) blockers.push('CASH_RETURN_FLOW_AFTER_SALE');
  if (blockers.length) return { ...base,status:'NEEDS_REVIEW',blockers,context };
  const flows = [{ date:start, amountMinor:-context.acquisitionMinor, kind:'ACQUISITION',sourceRef:context.acquisitionSourceRef }];
  for (const e of plan.entries) flows.push({date:e.date,amountMinor:e.amountMinor,kind:'RENT_RECEIPT',sourceRef:plan.sourceRef,reference:e.reference});
  for (const e of operatingEntries) flows.push({date:e.date,amountMinor:-e.amountMinor,kind:'OPERATING_PAYMENT',sourceRef:c.operatingPaymentPlan.sourceRef,reference:e.expenseId});
  for (const e of c.capitalPaymentPlan.entries) if (e.date >= start && e.date < end)
    flows.push({date:e.date,amountMinor:-e.amountMinor,kind:'CAPITAL_PAYMENT',sourceRef:c.capitalPaymentPlan.sourceRef,reference:e.capexItemId});
  for (const e of plan.otherFlows.entries) if (['TAX','FEES'].includes(e.category))
    flows.push({date:e.date,amountMinor:e.direction === 'INFLOW' ? e.amountMinor : -e.amountMinor,kind:e.category,sourceRef:e.sourceRef,reference:e.reference});
  if (context.exitTreatment === 'EXPLICIT_SALE') flows.push({date:context.saleDate,amountMinor:context.netSaleMinor,kind:'NET_SALE_PROCEEDS',sourceRef:context.saleSourceRef});
  // Aggregate exact minor units before conversion to the canonical dated solver.
  const byDate = new Map(); let magnitude = 0n;
  for (const flow of flows) {
    const amount = BigInt(flow.amountMinor); magnitude += amount < 0n ? -amount : amount;
    byDate.set(flow.date,(byDate.get(flow.date) || 0n)+amount);
  }
  if (magnitude > BigInt(Number.MAX_SAFE_INTEGER)) return {...base,status:'NEEDS_REVIEW',blockers:['CASH_AMOUNT_OUT_OF_RANGE'],context};
  const datedCashflows = [...byDate].sort(([a],[b]) => a.localeCompare(b)).map(([date,amount])=>({date,amount:Number(amount)/100}));
  const npvSar = xnpv(context.discountRate,datedCashflows);
  if (!Number.isFinite(npvSar)) return {...base,status:'NEEDS_REVIEW',blockers:['CASH_RETURN_NUMERIC_FAILURE'],context};
  const xirrDiagnostics = solveDatedXirr({cashflows:datedCashflows});
  return {...base,status:'CALCULATED_ENTERED_SCENARIO',context,flows,datedCashflows,npvSar,
    xirr:xirrDiagnostics.status === 'QUALIFIED' ? xirrDiagnostics.xirr : null,xirrDiagnostics,
    // An explicit sale amount must be net of sale costs/taxes; those must not
    // be re-entered in the independent tax/fee lines.
    exitValueIncluded:context.exitTreatment === 'EXPLICIT_SALE',
    excludedCapitalPayments:c.capitalPaymentPlan.entries.filter(e=>e.date<start||e.date>=end).length};
}
function investmentReturnContextFromDraft(draft,start,end) {
  const rate=parseNumericText(draft.discountPercent);
  if(!rate.ok)fail('CASH_RETURN_RATE_INVALID');
  return validateInvestmentReturnContext({schemaVersion:1,acquisitionMinor:parseLedgerAmount(draft.acquisitionAmount),
    acquisitionSourceRef:draft.acquisitionSourceRef,discountRate:rate.value/100,
    discountSourceRef:draft.discountSourceRef,reviewRef:draft.reviewRef,exitTreatment:draft.exitTreatment,
    ...(draft.exitTreatment==='EXPLICIT_SALE'?{saleDate:draft.saleDate,netSaleMinor:parseLedgerAmount(draft.netSaleAmount),saleSourceRef:draft.saleSourceRef}:{})},start,end);
}
module.exports = { validateInvestmentReturnContext, calculateEnteredInvestmentReturns, investmentReturnContextFromDraft };
