'use strict';
const validDate = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)
  && Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0,10) === v;
function defaultCashHorizonEnd(start) {
  if (!validDate(start)) throw new TypeError('CASH_HORIZON_REQUIRED');
  const d = new Date(start);
  d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth()+12);
  if(d.getUTCFullYear()>9999)throw new TypeError('CASH_HORIZON_INVALID');
  return d.toISOString().slice(0,10);
}
function cashHorizonPeriods(start, end) {
  if (!validDate(start) || !validDate(end) || end <= start) throw new TypeError('CASH_HORIZON_INVALID');
  const anchor=new Date(start),limit=new Date(start),day=anchor.getUTCDate();
  limit.setUTCDate(1);limit.setUTCFullYear(anchor.getUTCFullYear()+50);
  const monthEnd=new Date(limit);monthEnd.setUTCMonth(monthEnd.getUTCMonth()+1);monthEnd.setUTCDate(0);
  limit.setUTCDate(Math.min(day,monthEnd.getUTCDate()));
  if(Date.parse(end)>limit.getTime())throw new TypeError('CASH_HORIZON_INVALID');
  const rows = [];
  for (let date = start; date < end;) {
    const d = new Date(date);
    d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+1);
    const next = d.getUTCFullYear()>9999 ? end : d.toISOString().slice(0,10);
    const until = next < end ? next : end;
    rows.push({ periodStart: date, periodEndExclusive: until }); date = until;
  }
  return rows;
}
module.exports = { validDate, defaultCashHorizonEnd, cashHorizonPeriods };
