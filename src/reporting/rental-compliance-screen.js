'use strict';
// Regulatory screening of declared facts, not an authoritative legal or tax decision.
const P=require('../engines/financial/precision');
const RULE=Object.freeze({effective:'2025-09-25',reviewedThrough:'2026-11-25',durationYears:5,authority:'REGA',source:'https://rega.gov.sa/rega-services/platforms/ejar',instrument:'Royal Decree M/73, Council Decision 226, clauses II–VIII',vatSource:'https://zatca.gov.sa/ar/MediaCenter/Publications/Documents/النشرة الضريبية لإعفاء توريدات العقارات من ضريبة القيمة المضافة وأثره على معادلة الخصم النسبي.pdf'});
const day=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&Number.isFinite(Date.parse(x))&&new Date(x).toISOString().slice(0,10)===x;
const ref=x=>typeof x==='string'&&x.trim().length>0&&x.length<=300;
const amt=x=>typeof x==='number'&&Number.isFinite(x)&&x>=0&&x<=1e12&&P.money(x)===x;
function screenRent(x){
 if(!x||!day(x.asOf)||!['RIYADH_URBAN','OTHER','UNKNOWN'].includes(x.location)||!['RESIDENTIAL','COMMERCIAL','MIXED','OTHER','UNKNOWN'].includes(x.use)||!['EXISTING','PREVIOUSLY_LEASED_VACANT','NEVER_LEASED','UNKNOWN'].includes(x.leaseState)||!['NONE_DECLARED','PENDING','DECIDED','UNKNOWN'].includes(x.objection)||!amt(x.proposedGrossRentSar)||!(x.referenceGrossRentSar===null||amt(x.referenceGrossRentSar))||typeof x.samePeriodAndCharges!=='boolean')throw Error('RENT_COMPLIANCE_INPUT');
 const reasons=[];let status='REVIEW_REQUIRED',screeningReferenceSar=null,excessSar=null;
 if(x.asOf<RULE.effective||x.asOf>RULE.reviewedThrough)reasons.push('RULE_DATE_NOT_VERIFIED');
 else if(x.location!=='RIYADH_URBAN'||!ref(x.locationEvidence))reasons.push('URBAN_SCOPE_NOT_ESTABLISHED_OR_OTHER_REGION');
 else if(!['RESIDENTIAL','COMMERCIAL','MIXED'].includes(x.use))reasons.push('USE_SCOPE_NOT_ESTABLISHED');
 else if(x.leaseState==='NEVER_LEASED'){
  if(ref(x.leaseEvidence)&&x.referenceGrossRentSar===null){status='FIRST_LEASE_AGREEMENT_REVIEW';reasons.push('FIRST_LEASE_DECLARED_NO_PRIOR_RENT_REFERENCE');}
  else reasons.push('FIRST_LEASE_EVIDENCE_REQUIRED');
 }else if(!['EXISTING','PREVIOUSLY_LEASED_VACANT'].includes(x.leaseState))reasons.push('LEASE_HISTORY_REQUIRED');
 else if(!ref(x.leaseEvidence)||!x.samePeriodAndCharges||!amt(x.referenceGrossRentSar)||x.referenceGrossRentSar===0)reasons.push('COMPARABLE_GROSS_RENT_AND_CHARGES_REQUIRED');
 else if(x.objection!=='NONE_DECLARED')reasons.push('AUTHORITY_DECISION_OR_OBJECTION_REVIEW');
 else{screeningReferenceSar=x.referenceGrossRentSar;excessSar=Math.max(0,P.moneySub(x.proposedGrossRentSar,screeningReferenceSar));status=excessSar>0?'POTENTIAL_RENT_INCREASE_CONFLICT':'NO_INCREASE_DETECTED_ON_DECLARED_BASIS';}
 return {status,reasons,screeningReferenceSar,excessSar,rule:RULE,legalRentDetermined:false,locationVerified:false,contractAuthenticated:false,transactionAuthorized:false,financialInputEligible:false};
}
function screenLeaseVat(x){
 if(!x||!day(x.asOf)||!['PERMANENT_RESIDENTIAL','STANDARD_COMMERCIAL','OTHER_OR_MIXED','UNKNOWN'].includes(x.supply)||!['REGISTERED','UNREGISTERED','UNKNOWN'].includes(x.supplier)||!['EXCLUDED','INCLUDED','UNKNOWN'].includes(x.basis)||!(x.rentSar===null||amt(x.rentSar)))throw Error('RENT_VAT_INPUT');
 const out={status:'TAX_REVIEW_REQUIRED',illustrativeRate:null,netSar:null,vatSar:null,grossSar:null,taxLiabilityDetermined:false,financialInputEligible:false};
 if(x.asOf<'2020-10-04'||x.asOf>RULE.reviewedThrough||!ref(x.supplyEvidence)||x.rentSar===null||x.basis==='UNKNOWN')return out;
 if(x.supply==='PERMANENT_RESIDENTIAL'){return {...out,status:'DECLARED_RESIDENTIAL_EXEMPTION_SCREEN',illustrativeRate:0,netSar:x.rentSar,vatSar:0,grossSar:x.rentSar};}
 if(x.supply!=='STANDARD_COMMERCIAL'||x.supplier!=='REGISTERED'||!ref(x.registrationEvidence))return out;
 const gross=x.basis==='INCLUDED'?x.rentSar:P.moneyAdd(x.rentSar,P.moneyMulRate(x.rentSar,.15));
 const net=x.basis==='EXCLUDED'?x.rentSar:P.fromMoney(P.roundDiv(P.toMoney(gross)*100n,115n));
 return {...out,status:'DECLARED_STANDARD_COMMERCIAL_VAT_SCREEN',illustrativeRate:.15,netSar:net,vatSar:P.moneySub(gross,net),grossSar:gross};
}
module.exports={RULE,screenRent,screenLeaseVat};
