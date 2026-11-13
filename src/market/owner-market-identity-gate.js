'use strict';
// Restrictive *presentation* gate for the simplified owner experience.
// Does not certify property rights, evidence authenticity or current market
// value. The existing market and governance engines remain authoritative.
const PURPOSES=new Set(['ACQUISITION','SALE_STUDY','PORTFOLIO_REVIEW','RENT_STUDY','FINANCING_REVIEW','OTHER']);
const RIGHTS=new Set(['FULL_OWNERSHIP','USUFRUCT','LONG_LEASE','OTHER']);
const datePattern=/^\d{4}-\d{2}-\d{2}$/;
function marketIdentityGate(subject,now=new Date()){
  const issues=[];
  if(!subject||typeof subject!=='object'||Array.isArray(subject))return {allow:false,issues:['MARKET_SUBJECT_REQUIRED']};
  if(!PURPOSES.has(subject.valuationPurpose))issues.push('MARKET_PURPOSE_REQUIRED');
  const date=subject.valuationDate;
  const parsed=typeof date==='string'&&datePattern.test(date)?
    new Date(date+'T00:00:00.000Z'):new Date(NaN);
  if(!Number.isFinite(parsed.getTime())||parsed.toISOString().slice(0,10)!==date){
    issues.push('VALUATION_DATE_REQUIRED_OR_INVALID');
  }else{
    const clock=now instanceof Date?now:new Date(now);
    if(!Number.isFinite(clock.getTime()))throw Error('MARKET_IDENTITY_CLOCK_INVALID');
    // Saudi market evaluation dates are calendar dates in the target market,
    // not browser/runner-local time (which can fall on a different day).
    const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Riyadh',year:'numeric',month:'2-digit',day:'2-digit'}).format(clock);
    if(date>today)issues.push('FUTURE_VALUATION_DATE_NOT_SUPPORTED');
  }
  if(!RIGHTS.has(subject.propertyRight))issues.push('PROPERTY_RIGHT_DECLARATION_REQUIRED');
  if(typeof subject.name!=='string'||!subject.name.trim())issues.push('MARKET_SUBJECT_NAME_REQUIRED');
  return {allow:issues.length===0,issues};
}
module.exports={marketIdentityGate};
