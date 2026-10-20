import React from 'react';
const {receivablesPeriodLabels}=require('../app/receivables-period-presentation');
const {formatCashMinor}=require('../residential-income-acquisition/cash-scenario');

export default function ReceivablesPeriodReconciliation({result,locale='ar-SA'}) {
  const l=receivablesPeriodLabels(locale),complete=result?.status==='ARITHMETIC_BRIDGE_COMPLETE';
  const wrap=(label,headers,rows)=><div role="region" aria-label={label} tabIndex={0} className="min-w-0 max-w-full overflow-x-auto rounded border border-slate-700"><table className="w-full min-w-[36rem] text-xs"><thead><tr>{headers.map((h,i)=><th className="p-2 text-start" scope="col" key={i}>{h}</th>)}</tr></thead><tbody>{rows.map((row,i)=><tr key={i}>{row.map((cell,j)=><td className="p-2 align-top" key={j}>{cell}</td>)}</tr>)}</tbody></table></div>;
  const amount=(value,testId)=><span dir="ltr" className="inline-block whitespace-nowrap tabular-nums" data-testid={testId}>{formatCashMinor(value)}</span>;
  const user=value=><span data-user-content translate="no">{value||'—'}</span>;
  const entries=rows=><>{wrap(l.events,[l.id,l.date,l.type,l.amount,l.lease,l.target],rows.map(e=>[user(e.id),user(e.date),l.row[e.type],amount(e.amountMinor),user(e.leaseId),user([...new Set([e.targetId,e.receiptId].filter(Boolean))].join(', '))]))}{wrap(l.source,[l.id,l.reference,l.source,l.reviewer],rows.map(e=>[user(e.id),user(e.reference),user(e.sourceRef),user(e.reviewRef)]))}</>;
  return <section data-testid="receivables-period-bridge" data-status={result?.status||'NOT_AVAILABLE'} className="min-w-0 space-y-3 rounded border border-slate-600 p-3">
    <h3 className="font-bold">{l.title}</h3><p>{l.scope}</p>
    {result?.periodStart&&<p dir="ltr">{result.periodStart} — {result.periodEndExclusive}</p>}
    <p role="status">{complete?l.complete:result?.status==='NEEDS_REVIEW'?l.review:l.unavailable}</p>
    {complete&&<>
      {wrap(l.title,[l.code,l.unpaid,l.unallocated],result.rows.map(row=>[l.row[row.code],amount(row.outstandingMinor,`receivables-period-${row.code}-unpaid`),amount(row.unallocatedMinor,`receivables-period-${row.code}-unallocated`)]))}
      <h4>{l.leases}</h4>{wrap(l.leases,[l.lease,l.openingUnpaid,l.closingUnpaid,l.openingUnallocated,l.closingUnallocated],result.byLease.map(row=>[user(row.leaseId),amount(row.openingMinor.outstandingMinor),amount(row.closingMinor.outstandingMinor),amount(row.openingMinor.unallocatedMinor),amount(row.closingMinor.unallocatedMinor)]))}
      <details><summary>{l.events} ({result.eventRows.length})</summary>{entries(result.eventRows)}</details>
      {result.postPeriodCorrections.length>0&&<div data-testid="receivables-period-later-corrections"><p role="status">{l.later}</p><details><summary>{l.corrections} ({result.postPeriodCorrections.length})</summary>{entries(result.postPeriodCorrections)}</details></div>}
    </>}
  </section>;
}
