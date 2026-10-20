'use strict';
const { replayReceivablesLedger } = require('./receivables-ledger');

const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;
const safe = value => {
  if (value > BigInt(Number.MAX_SAFE_INTEGER) || value < -BigInt(Number.MAX_SAFE_INTEGER))
    throw new TypeError('LEDGER_PERIOD_AMOUNT_OUT_OF_RANGE');
  return Number(value);
};
const pair = () => ({ outstanding: 0n, unallocated: 0n });
function endpoint(summary) {
  const leases = new Map();
  const get = id => { if (!leases.has(id)) leases.set(id,pair()); return leases.get(id); };
  for (const row of summary.chargeRows) get(row.leaseId).outstanding += BigInt(row.outstandingMinor);
  for (const row of summary.receiptRows) get(row.leaseId).unallocated += BigInt(row.unallocatedMinor);
  const total = pair();
  for (const value of leases.values()) {
    total.outstanding += value.outstanding; total.unallocated += value.unallocated;
  }
  return { total, leases };
}
function numbers(value) {
  return { outstandingMinor:safe(value.outstanding), unallocatedMinor:safe(value.unallocated) };
}

// An entered-event-date bridge of this local register, never contract revenue,
// cash execution, bank authentication, completeness or retrospective attestation.
function calculateReceivablesPeriodReconciliation(c, period = c?.bankRentStatement) {
  const base = { schemaVersion:1, calculationVersion:'LEDGER_PERIOD_RECONCILIATION_V1',
    status:'NOT_AVAILABLE', blockers:[], caseId:c?.caseId || null, asOfDate:c?.asOfDate || null,
    periodStart:period?.periodStart || null, periodEndExclusive:period?.periodEndExclusive || null,
    dateBasis:'ENTERED_EVENT_DATE', currency:'SAR', amountUnit:'halala',
    rows:[], eventRows:[], byLease:[], postPeriodCorrections:[], openingMinor:null, closingMinor:null,
    coverageComplete:false, sourceIndependentlyVerified:false, actualBankBalance:false,
    aggregateEngineUpdated:false, transactionAuthorized:false };
  if (!period) return { ...base, blockers:['LEDGER_PERIOD_REQUIRED'] };
  const start = period.periodStart, end = period.periodEndExclusive, asOf = c?.asOfDate?.slice(0,10);
  if (!validDate(start) || !validDate(end) || !validDate(asOf) || start >= end
    || Date.parse(end) > Date.parse(asOf)+86400000)
    return { ...base, status:'NEEDS_REVIEW', blockers:['LEDGER_PERIOD_INVALID'] };
  if (!c.receivablesLedger?.events?.length) return { ...base, blockers:['LEDGER_EVENTS_REQUIRED'] };
  try {
    // Canonical replay validates the complete graph, including later corrections.
    // Filtered replays preserve original dependency order and exclusive cutoffs.
    const events = replayReceivablesLedger(c.receivablesLedger,c).ledger.events;
    const byId = new Map(events.map(event => [event.id,event]));
    const at = cutoff => endpoint(replayReceivablesLedger({ ...c.receivablesLedger,
      events:events.filter(event => event.date < cutoff) },c).summary);
    const opening = at(start), closing = at(end);
    const effect = event => {
      const target = event.type === 'REVERSAL' ? byId.get(event.targetId) : event;
      const amount = BigInt(target.amountMinor), sign = event.type === 'REVERSAL' ? -1n : 1n;
      const leaseId = target.leaseId || byId.get(target.chargeId || target.receiptId).leaseId;
      const delta = pair();
      if (target.type === 'CHARGE') delta.outstanding = amount;
      if (target.type === 'CREDIT') delta.outstanding = -amount;
      if (target.type === 'RECEIPT') delta.unallocated = amount;
      if (target.type === 'REFUND') delta.unallocated = -amount;
      if (target.type === 'ALLOCATION') { delta.outstanding = -amount; delta.unallocated = -amount; }
      return { leaseId, target, outstanding:delta.outstanding*sign, unallocated:delta.unallocated*sign };
    };
    const categories = ['CHARGE','CREDIT','RECEIPT','REFUND','ALLOCATION','REVERSAL'];
    const totals = new Map(categories.map(code => [code,pair()]));
    const leaseDeltas = new Map();
    const eventRow = event => {
      const delta = effect(event);
      return { id:event.id, date:event.date, type:event.type, leaseId:delta.leaseId,
        amountMinor:delta.target.amountMinor, reference:event.reference || null,
        sourceRef:event.sourceRef, reviewRef:event.reviewRef,
        targetId:event.targetId || event.chargeId || event.receiptId || null,
        receiptId:event.receiptId || null,
        reversedType:event.type === 'REVERSAL' ? delta.target.type : null,
        ...numbers(delta) };
    };
    const eventRows = [];
    for (const event of events) if (event.date >= start && event.date < end) {
      const delta = effect(event), category = totals.get(event.type);
      category.outstanding += delta.outstanding; category.unallocated += delta.unallocated;
      if (!leaseDeltas.has(delta.leaseId)) leaseDeltas.set(delta.leaseId,pair());
      const lease = leaseDeltas.get(delta.leaseId);
      lease.outstanding += delta.outstanding; lease.unallocated += delta.unallocated;
      eventRows.push(eventRow(event));
    }
    const rows = [{ code:'OPENING', ...numbers(opening.total) },
      ...categories.map(code => ({ code, ...numbers(totals.get(code)) })),
      { code:'CLOSING', ...numbers(closing.total) }];
    const residual = pair();
    for (const key of ['outstanding','unallocated']) residual[key] = closing.total[key]-opening.total[key]
      - [...totals.values()].reduce((sum,value) => sum+value[key],0n);
    rows.push({ code:'RESIDUAL', ...numbers(residual) });
    const leaseIds = new Set([...opening.leases.keys(),...closing.leases.keys(),...leaseDeltas.keys()]);
    const byLease = [...leaseIds].sort().map(leaseId => {
      const before=opening.leases.get(leaseId)||pair(), after=closing.leases.get(leaseId)||pair();
      const delta=leaseDeltas.get(leaseId)||pair();
      if (after.outstanding-before.outstanding-delta.outstanding !== 0n
        || after.unallocated-before.unallocated-delta.unallocated !== 0n)
        throw new TypeError('LEDGER_PERIOD_RESIDUAL');
      return { leaseId, openingMinor:numbers(before), closingMinor:numbers(after) };
    });
    if (residual.outstanding !== 0n || residual.unallocated !== 0n) throw new TypeError('LEDGER_PERIOD_RESIDUAL');
    // Do not silently erase an earlier-period entry because it is corrected later.
    // Keep those later corrections visible, without treating them as cash refunds.
    const postPeriodCorrections = events.filter(event => event.type === 'REVERSAL'
      && event.date >= end && byId.get(event.targetId).date < end).map(eventRow);
    return { ...base, status:'ARITHMETIC_BRIDGE_COMPLETE', rows, eventRows, byLease, postPeriodCorrections,
      openingMinor:numbers(opening.total), closingMinor:numbers(closing.total),
      semantics:'Opening and closing balances are reconstructed from supplied events strictly before each cutoff, using entered event dates and canonical dependency replay. Charges are documents, not earned contract accrual; allocations reduce both unpaid charges and unallocated receipts without new cash. Credits and refunds are separate. Reversals are document corrections, not cash movements. Later corrections are disclosed separately. Current statement matching uses the currently active corrected register and may differ from this earlier-date reconstruction. Missing register data is unavailable, not zero. No source completeness, bank authenticity, general-ledger reconciliation, aggregate NOI change or transaction authority is inferred.' };
  } catch (error) {
    return { ...base, status:'NEEDS_REVIEW', blockers:[error.message || 'LEDGER_PERIOD_REPLAY_FAILED'] };
  }
}
module.exports = { calculateReceivablesPeriodReconciliation };
