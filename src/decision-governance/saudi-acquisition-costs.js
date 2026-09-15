'use strict';
const PARTY = Object.freeze({ SELLER:'SELLER', BUYER:'BUYER', SHARED:'SHARED', CONTRACTUAL_OTHER:'CONTRACTUAL_OTHER', OTHER:'OTHER', UNKNOWN:'UNKNOWN' });
function money(v,n){ if(v==null||v==='') return null; const x=Number(v); if(!Number.isFinite(x)||x<0) throw new RangeError(`${n} must be finite and >= 0`); return x; }
function rate(v,n){ const x=money(v,n); if(x==null) return null; if(x>1) throw new RangeError(`${n} must be decimal 0..1`); return x; }
function buyerShare(payer, sharedBuyerShare){ if(payer==='BUYER') return 1; if(payer==='SHARED'){ const s=rate(sharedBuyerShare,'sharedBuyerShare'); return s==null?null:s; } if(['SELLER','CONTRACTUAL_OTHER','OTHER'].includes(payer)) return 0; return null; }
function calculateSaudiAcquisitionCosts(input={}){
 const price=money(input.purchasePrice,'purchasePrice'); if(price==null) throw new TypeError('purchasePrice is required');
 const rr=rate(input.rettRate,'rettRate'); const rettAmount=money(input.rettAmount,'rettAmount') ?? (rr==null?null:price*rr);
 const rb=buyerShare(input.rettEconomicBearer||'UNKNOWN',input.rettBuyerShare); const rettBuyer=rb==null?0:(rettAmount||0)*rb;
 const br=rate(input.brokerageRate,'brokerageRate'); const brokerageAmount=money(input.brokerageAmount,'brokerageAmount') ?? (br==null?null:price*br);
 const bb=buyerShare(input.brokeragePayer||'UNKNOWN',input.brokerageBuyerShare); const brokerageBuyer=bb==null?0:(brokerageAmount||0)*bb;
 const warnings=[]; if(rb==null) warnings.push('RETT_ECONOMIC_BEARER_UNKNOWN_NO_BUYER_CHARGE_ASSUMED'); if(bb==null) warnings.push('BROKERAGE_PAYER_UNKNOWN_NO_BUYER_CHARGE_ASSUMED');
 const basis=price+(input.rettIncludedInAcquisitionBasis===false?0:rettBuyer)+(input.brokerageIncludedInAcquisitionBasis===false?0:brokerageBuyer);
 return Object.freeze({ purchasePrice:price, rett:{rate:rr,statutoryLiableParty:input.rettStatutoryLiableParty||'UNKNOWN',economicBearer:input.rettEconomicBearer||'UNKNOWN',amount:rettAmount,buyerEconomicAmount:rettBuyer,includedInAcquisitionBasis:input.rettIncludedInAcquisitionBasis!==false,source:input.rettSource||null,sourceDate:input.rettSourceDate||null,assumptionType:input.rettAssumptionType||null}, brokerage:{rate:br,payer:input.brokeragePayer||'UNKNOWN',amount:brokerageAmount,buyerEconomicAmount:brokerageBuyer,agreementType:input.brokerageAgreementType||null,includedInAcquisitionBasis:input.brokerageIncludedInAcquisitionBasis!==false,source:input.brokerageSource||null,assumptionType:input.brokerageAssumptionType||null}, acquisitionBasis:basis,warnings:Object.freeze(warnings) });
}
module.exports={PARTY,calculateSaudiAcquisitionCosts};
