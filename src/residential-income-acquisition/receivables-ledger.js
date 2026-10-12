'use strict';

// Local, append-only document register. It does not issue tax invoices or
// infer receipts from contractual accrual. All arithmetic is in integer halalas.
const fail = code => { throw new TypeError(code); };
function text(value) {
  if (typeof value !== 'string' || !value.trim() || value.length > 500) fail('LEDGER_TEXT_REQUIRED');
  return value.trim();
}
function date(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0,10) !== value) fail('LEDGER_DATE_INVALID');
  return value;
}
function minor(value) {
  if (!Number.isSafeInteger(value) || value <= 0) fail('LEDGER_AMOUNT_INVALID');
  return value;
}
function add(a,b) {
  const result = a+b;
  if (!Number.isSafeInteger(result)) fail('LEDGER_TOTAL_OUT_OF_RANGE');
  return result;
}
function parseLedgerAmount(value) {
  if (typeof value !== 'string' && typeof value !== 'number') fail('LEDGER_AMOUNT_INVALID');
  const normalized = String(value).trim().replace(/[٠-٩]/g,d=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[۰-۹]/g,d=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/٫/g,'.');
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) fail('LEDGER_AMOUNT_INVALID');
  const [whole,fraction=''] = normalized.split('.');
  return minor(Number(whole)*100+Number(fraction.padEnd(2,'0')));
}

function replayReceivablesLedger(input, operatingCase) {
  const {caseId,leases,asOfDate} = operatingCase;
  const asOf = date(asOfDate.slice(0,10));
  if (!input || input.schemaVersion !== 1 || input.caseId !== caseId || !Array.isArray(input.events)) fail('LEDGER_CASE_INVALID');
  if (input.events.length > 5000) fail('LEDGER_LIMIT_EXCEEDED');
  const leaseById = new Map(leases.map(l=>[l.leaseId,l]));
  const records = new Map(), references = new Set(), reversed = new Set(), used = new Map(), events = [];
  const refunded = new Map(), receiptMovement = new Map(), refundReceipts = new Set();
  const moveReceipt = (id, when, strict = false) => {
    if ((strict || refundReceipts.has(id)) && when < (receiptMovement.get(id)||'')) fail('LEDGER_EVENT_CHRONOLOGY');
    receiptMovement.set(id,when > (receiptMovement.get(id)||'') ? when : receiptMovement.get(id));
  };
  for (const raw of input.events) {
    if (!raw || raw.caseId !== caseId) fail('LEDGER_CASE_INVALID');
    const event = {id:text(raw.id),caseId,type:raw.type,date:date(raw.date),sourceRef:text(raw.sourceRef),reviewRef:text(raw.reviewRef)};
    if (event.sourceRef === event.reviewRef) fail('LEDGER_DISTINCT_REVIEW_REQUIRED');
    if (event.date > asOf) fail('LEDGER_FUTURE_EVENT');
    if (records.has(event.id)) fail('LEDGER_DUPLICATE_ID');
    if (event.type === 'CHARGE' || event.type === 'RECEIPT') {
      event.leaseId = text(raw.leaseId);
      const lease = leaseById.get(event.leaseId);
      if (!lease) fail('LEDGER_LEASE_NOT_FOUND');
      event.reference = text(raw.reference);
      const refKey = JSON.stringify([event.type,event.reference]);
      if (references.has(refKey)) fail('LEDGER_DUPLICATE_REFERENCE');
      references.add(refKey); // Even reversed documents retain their reference.
      event.amountMinor = minor(raw.amountMinor);
      if (event.type === 'RECEIPT') moveReceipt(event.id,event.date);
      if (event.type === 'CHARGE') {
        event.periodStart = date(raw.periodStart);
        event.periodEndExclusive = date(raw.periodEndExclusive);
        event.dueDate = date(raw.dueDate);
        if (!lease.startDate || !lease.endDate || event.periodStart < lease.startDate.slice(0,10) || event.periodEndExclusive > lease.endDate.slice(0,10) || event.periodStart >= event.periodEndExclusive) fail('LEDGER_PERIOD_OUTSIDE_LEASE');
        for (const prior of records.values()) {
          if (prior.type === 'CHARGE' && prior.leaseId === event.leaseId && !reversed.has(prior.id) && event.periodStart < prior.periodEndExclusive && prior.periodStart < event.periodEndExclusive) fail('LEDGER_OVERLAPPING_CHARGES');
        }
      }
    } else if (event.type === 'ALLOCATION') {
      event.chargeId = text(raw.chargeId);
      event.receiptId = text(raw.receiptId);
      event.amountMinor = minor(raw.amountMinor);
      const charge = records.get(event.chargeId), receipt = records.get(event.receiptId);
      if (charge?.type !== 'CHARGE' || receipt?.type !== 'RECEIPT' || reversed.has(charge.id) || reversed.has(receipt.id)) fail('LEDGER_ALLOCATION_REFERENCE_INVALID');
      if (charge.leaseId !== receipt.leaseId) fail('LEDGER_CROSS_LEASE_ALLOCATION');
      if (event.date < charge.date || event.date < receipt.date) fail('LEDGER_EVENT_CHRONOLOGY');
      moveReceipt(receipt.id,event.date);
      for (const target of [charge,receipt]) {
        const total = add(used.get(target.id)||0,event.amountMinor);
        if (total > target.amountMinor-(refunded.get(target.id)||0)) fail('LEDGER_OVERALLOCATION');
        used.set(target.id,total);
      }
    } else if (event.type === 'REFUND') {
      event.receiptId=text(raw.receiptId);
      event.reference=text(raw.reference);
      event.reason=text(raw.reason);
      event.amountMinor=minor(raw.amountMinor);
      const receipt=records.get(event.receiptId);
      if (receipt?.type !== 'RECEIPT' || reversed.has(receipt.id)) fail('LEDGER_REFUND_REFERENCE_INVALID');
      moveReceipt(receipt.id,event.date,true);
      const refKey=JSON.stringify([event.type,event.reference]);
      if (references.has(refKey)) fail('LEDGER_DUPLICATE_REFERENCE');
      references.add(refKey);
      const total=add(refunded.get(receipt.id)||0,event.amountMinor);
      if (total > receipt.amountMinor-(used.get(receipt.id)||0)) fail('LEDGER_OVERREFUND');
      refunded.set(receipt.id,total);
      refundReceipts.add(receipt.id);
    } else if (event.type === 'REVERSAL') {
      event.targetId = text(raw.targetId);
      event.reason = text(raw.reason);
      const target = records.get(event.targetId);
      if (!target || target.type === 'REVERSAL' || reversed.has(target.id)) fail('LEDGER_REVERSAL_REFERENCE_INVALID');
      if (event.date < target.date) fail('LEDGER_EVENT_CHRONOLOGY');
      if (target.type === 'RECEIPT') moveReceipt(target.id,event.date);
      if (target.type === 'ALLOCATION') {
        moveReceipt(target.receiptId,event.date);
        used.set(target.chargeId,(used.get(target.chargeId)||0)-target.amountMinor);
        used.set(target.receiptId,(used.get(target.receiptId)||0)-target.amountMinor);
      } else if (target.type === 'REFUND') {
        moveReceipt(target.receiptId,event.date,true);
        refunded.set(target.receiptId,(refunded.get(target.receiptId)||0)-target.amountMinor);
      } else if (refunded.get(target.id)) fail('LEDGER_REVERSE_REFUNDS_FIRST');
      else if (used.get(target.id)) fail('LEDGER_REVERSE_ALLOCATIONS_FIRST');
      reversed.add(target.id);
    } else fail('LEDGER_TYPE_INVALID');
    records.set(event.id,event);
    events.push(event);
  }
  const ledger = {schemaVersion:1,caseId,events};
  const chargeRows=[], receiptRows=[], refundRows=[], months=new Map(), refundMonths=new Map();
  const aging = {notDue:0,dueToday:0,days1to30:0,days31to60:0,days61to90:0,daysOver90:0};
  let charged=0,received=0,allocated=0,returned=0;
  for (const event of events) {
    if (reversed.has(event.id)) continue;
    if (event.type === 'CHARGE') {
      const applied=used.get(event.id)||0, outstanding=event.amountMinor-applied;
      const overdueDays=Math.round((Date.parse(asOf)-Date.parse(event.dueDate))/86400000);
      const bucket=overdueDays<0?'notDue':overdueDays===0?'dueToday':overdueDays<=30?'days1to30':overdueDays<=60?'days31to60':overdueDays<=90?'days61to90':'daysOver90';
      aging[bucket]=add(aging[bucket],outstanding);
      charged=add(charged,event.amountMinor);allocated=add(allocated,applied);
      chargeRows.push({...event,allocatedMinor:applied,outstandingMinor:outstanding,overdueDays:Math.max(0,overdueDays),agingBucket:bucket});
    } else if (event.type === 'RECEIPT') {
      const applied=used.get(event.id)||0;
      received=add(received,event.amountMinor);
      const returnedAmount=refunded.get(event.id)||0;
      receiptRows.push({...event,allocatedMinor:applied,refundedMinor:returnedAmount,unallocatedMinor:event.amountMinor-applied-returnedAmount});
      const month=event.date.slice(0,7);
      months.set(month,add(months.get(month)||0,event.amountMinor));
    } else if (event.type === 'REFUND') {
      returned=add(returned,event.amountMinor);
      refundRows.push({...event,leaseId:records.get(event.receiptId).leaseId});
      const month=event.date.slice(0,7);
      refundMonths.set(month,add(refundMonths.get(month)||0,event.amountMinor));
    }
  }
  return {ledger,summary:{schemaVersion:1,caseId,asOfDate,status:events.length?'RECORDED':'NOT_AVAILABLE',currency:'SAR',amountUnit:'halala',chargeRows,receiptRows,reversedIds:[...reversed],agingMinor:aging,
    totalsMinor:events.length?{charged,received,allocated,outstanding:charged-allocated,unallocated:received-allocated-returned,refunded:returned,netReceived:received-returned}:null,
    refundRows,monthlyRefunds:[...refundMonths].sort(([a],[b])=>a.localeCompare(b)).map(([month,amountMinor])=>({month,amountMinor})),
    monthlyReceipts:[...months].sort(([a],[b])=>a.localeCompare(b)).map(([month,amountMinor])=>({month,amountMinor})),
    scope:'Locally entered rent-only document register, as of the case date. Not a tax invoice, bank verification, forecast or general ledger. Separate from period collection aggregates; never summed with them or written to NOI. Reversals correct entries and are not cash refunds.',professionalReleaseAuthorized:false,financialEngineUpdated:false}};
}

function appendReceivablesEvent(operatingCase,draft) {
  if (draft?.confirmed !== true) fail('EXPLICIT_VERIFICATION_CONFIRMATION_REQUIRED');
  const {createResidentialIncomeOperatingCase} = require('./contracts');
  const event={...draft,caseId:operatingCase.caseId};
  delete event.confirmed;
  if (event.type !== 'REVERSAL') event.amountMinor=parseLedgerAmount(draft.amount);
  delete event.amount;
  const ledger=operatingCase.receivablesLedger||{schemaVersion:1,caseId:operatingCase.caseId,events:[]};
  return createResidentialIncomeOperatingCase({...operatingCase,receivablesLedger:{...ledger,events:[...ledger.events,event]}});
}

function calculateReceivablesLedger(operatingCase) {
  return replayReceivablesLedger(operatingCase.receivablesLedger||{schemaVersion:1,caseId:operatingCase.caseId,events:[]},operatingCase).summary;
}

module.exports={parseLedgerAmount,replayReceivablesLedger,appendReceivablesEvent,calculateReceivablesLedger};
