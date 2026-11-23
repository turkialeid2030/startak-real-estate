'use strict';
// Deterministic Gregorian date evidence parsing. Date.parse can normalize
// invalid calendar days, creating unsafe source-freshness conclusions.
// Date-only means UTC midnight; timestamps require an explicit timezone.
// This helper never authenticates a source, issuer, license or signature.
const FORMAT=/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?(Z|[+-]\d{2}:\d{2}))?$/;
function strictCalendarDateMs(input){
  if(typeof input!=='string')return NaN;
  const m=FORMAT.exec(input);
  if(!m)return NaN;
  const year=Number(m[1]),month=Number(m[2]),day=Number(m[3]);
  if(year<1000||month<1||month>12||day<1)return NaN;
  const leap=year%4===0&&(year%100!==0||year%400===0);
  const monthDays=[31,leap?29:28,31,30,31,30,31,31,30,31,30,31];
  if(day>monthDays[month-1])return NaN;
  if(m[4]!==undefined){
    const hour=Number(m[4]),minute=Number(m[5]),second=Number(m[6]||0);
    if(hour>23||minute>59||second>59)return NaN;
    const zone=m[8];
    if(zone!=='Z'){
      const hh=Number(zone.slice(1,3)),mm=Number(zone.slice(4,6));
      if(hh>14||mm>59||(hh===14&&mm!==0))return NaN;
    }
  }
  const ms=Date.parse(m[4]===undefined?input+'T00:00:00Z':input);
  return Number.isFinite(ms)?ms:NaN;
}
module.exports={strictCalendarDateMs};
