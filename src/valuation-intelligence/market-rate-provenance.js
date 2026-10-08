'use strict';

const crypto=require('node:crypto');
const {evaluateEntryExitCapRateGovernance,CAP_RATE_GOVERNANCE_STATUS}=require('./cap-rate-governance');
const {INPUT_STATUS,EVIDENCE_GRADE}=require('./contracts');

const VERSION='C60_INCOME_RATE_PROVENANCE_V1';
const STATUS=Object.freeze({
  HOLD:'HOLD_RATE_MARKET_PROVENANCE',
  READY_FOR_EXTERNAL_AUTHENTICATION:'READY_FOR_EXTERNAL_RATE_AUTHENTICATION',
});
const HEX64=/^[a-f0-9]{64}$/i;
function filled(x){return typeof x==='string'&&x.trim().length>0;}
function date(x){return filled(x)&&/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(x)&&Number.isFinite(Date.parse(x))&&new Date(x).toISOString().slice(0,10)===x.slice(0,10);}
function finite(v){return typeof v==='number'&&Number.isFinite(v);}
function freeze(v){if(v&&typeof v==='object'&&!Object.isFrozen(v)){Object.values(v).forEach(freeze);Object.freeze(v);}return v;}
function stable(x){return Array.isArray(x)?x.map(stable):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,stable(x[k])])):x;}
function hash(x){return crypto.createHash('sha256').update(JSON.stringify(stable(x))).digest('hex');}
function med(sorted){const i=Math.floor(sorted.length/2);return sorted.length%2?sorted[i]:(sorted[i-1]+sorted[i])/2;}
function fail(blockers,extra={}){return freeze({version:VERSION,status:STATUS.HOLD,blockers:[...new Set(blockers)],
  independentSaudiRateEvidenceVerified:false,professionalAppraisalEstablished:false,
  transactionAuthorized:false,productionDecisionAuthorized:false,...extra});}
/**
 * Structural, independent evidence-preflight for actual executed income-property
 * cap rate observations and separately justified prospective exit/discount rates.
 * No test fixture or self-declared signed source reference is a market fact.
 */
function assessMarketRateProvenance({
  assetClass,city,valuationDate,asOf,comparables,
  entryCapRate,exitCapRate,discountRate,
  rateMethodology,policy,terminalNoiSar,
}={}){
 const blockers=[],warnings=[];
 if(!filled(assetClass)||!filled(city))blockers.push('ASSET_CLASS_CITY_REQUIRED');
 if(!date(valuationDate)||!date(asOf)||(date(asOf)&&date(valuationDate)&&Date.parse(asOf)<Date.parse(valuationDate)))
   blockers.push('VALUATION_AND_ASOF_DATES_INVALID');
 if(!Array.isArray(comparables))return fail([...blockers,'MARKET_RATE_COMPARABLES_ARRAY_REQUIRED']);
 if(!policy||!Number.isInteger(policy.minExecutedTransactions)||policy.minExecutedTransactions<2||
   !Number.isInteger(policy.maxComparableAgeDays)||policy.maxComparableAgeDays<0||
   !finite(policy.maxEntryMedianDeviationBps)||policy.maxEntryMedianDeviationBps<0||
   !finite(policy.maxRateReconciliationErrorBps)||policy.maxRateReconciliationErrorBps<0||
   !finite(policy.stressNoiShockPercent)||policy.stressNoiShockPercent<=0||policy.stressNoiShockPercent>=1||
   !finite(policy.stressCapShockBps)||policy.stressCapShockBps<=0)
   return fail([...blockers,'PREDECLARED_RATE_STRESS_AND_EVIDENCE_POLICY_REQUIRED']);
 if(![entryCapRate,exitCapRate].every(x=>finite(x)&&x>0&&x<1)||
    !finite(discountRate)||discountRate<=0||discountRate>=1)blockers.push('CAP_OR_DISCOUNT_RATE_INVALID');
 if(!finite(terminalNoiSar)||terminalNoiSar<=0)blockers.push('TERMINAL_NOI_REQUIRED');
 const seen=new Set(),rates=[];
 for(const [i,c] of comparables.entries()){
   const id=c?.transactionRef||'UNKNOWN_'+i,recBlock=[];
   if(!filled(c?.transactionRef)||seen.has(c.transactionRef))recBlock.push('DUPLICATE_OR_MISSING_UNDERLYING_TRANSACTION');
   if(filled(c?.transactionRef))seen.add(c.transactionRef);
   if(c?.transactionStatus!=='EXECUTED_SALE')recBlock.push('ASKING_OFFER_NOT_EXECUTED_SALE');
   if(c?.assetClass!==assetClass||c?.city!==city)recBlock.push('RATE_ASSET_MARKET_MISMATCH');
   if(!date(c?.transactionDate)||!date(valuationDate)||Date.parse(c.transactionDate)>Date.parse(valuationDate)||
      (date(c?.transactionDate)&&date(valuationDate)&&Math.floor((Date.parse(valuationDate)-Date.parse(c.transactionDate))/86400000)>policy.maxComparableAgeDays))
      recBlock.push('RATE_MARKET_TIMING_STALE_OR_FUTURE');
   if(!filled(c?.sourceProviderRef)||!filled(c?.sourceEvidenceRef)||!HEX64.test(c?.sourceArtifactSha256||'')||
      !filled(c?.sourceRightsEvidenceRef)||!filled(c?.sourceVerificationReviewerRef)||!date(c?.reviewedAt)||
      (date(asOf)&&date(c?.reviewedAt)&&Date.parse(c.reviewedAt)>Date.parse(asOf)))
      recBlock.push('REAL_TRANSACTION_SOURCE_PROVENANCE_REQUIRED');
   if(c?.incomeBasis!=='NET_OPERATING_INCOME_ANNUAL_SAR'||c?.incomeTreatment!=='LANDLORD_NET_OPERATING'||
      !filled(c?.noiNormalizationEvidenceRef)||!filled(c?.leasingEvidenceRef))
      recBlock.push('NOI_DEFINITION_AND_RENT_ROLL_REQUIRED');
   const validValues=['priceSar','grossAnnualRentalSar','vacancyLossSar','landlordOperatingExpensesSar','normalizedNetAdjustmentsSar','annualNetOperatingIncomeSar']
     .every(k=>finite(c?.[k]));
   if(!validValues||c.priceSar<=0||c.grossAnnualRentalSar<=0||c.vacancyLossSar<0||
     c.landlordOperatingExpensesSar<0||c.vacancyLossSar>=c.grossAnnualRentalSar||
     c.annualNetOperatingIncomeSar<=0||
     Math.abs(c.grossAnnualRentalSar-c.vacancyLossSar-c.landlordOperatingExpensesSar+
       c.normalizedNetAdjustmentsSar-c.annualNetOperatingIncomeSar)>0.0100001)
      recBlock.push('NOI_BRIDGE_OR_PRICE_INVALID');
   if(validValues&&c.priceSar>0&&c.annualNetOperatingIncomeSar>0){
     const rate=c.annualNetOperatingIncomeSar/c.priceSar;
     if(!finite(rate)||rate<=0||rate>=1)recBlock.push('OBSERVED_TRANSACTION_YIELD_IMPLAUSIBLE');
     if(!recBlock.length)rates.push({transactionRef:id,rate});
   }
   blockers.push(...recBlock.map(x=>id+':'+x));
 }
 if(rates.length<policy.minExecutedTransactions)
   blockers.push('INSUFFICIENT_QUALIFIED_INCOME_COMPARABLES:'+rates.length+'/'+policy.minExecutedTransactions);
 const measuredRates=rates.map(x=>x.rate).sort((a,b)=>a-b);
 const medianCap=measuredRates.length?med(measuredRates):null;
 if(medianCap!==null&&finite(entryCapRate)){
   const deviation=Math.abs(entryCapRate-medianCap)*10000;
   if(deviation>policy.maxEntryMedianDeviationBps)blockers.push('ENTRY_CAP_RATE_OUTSIDE_PREDECLARED_EVIDENCE_BAND');
 }
 const m=rateMethodology;
 if(!m||!filled(m.entryReviewMethodRef)||!filled(m.entryReviewedByRef)||!filled(m.entryEvidenceRef)||
   !filled(m.exitReviewMethodRef)||!filled(m.exitReviewedByRef)||!filled(m.exitEvidenceRef)||
   !filled(m.exitFutureRiskRationale)||!filled(m.discountReviewMethodRef)||!filled(m.discountReviewedByRef)||
   !filled(m.discountEvidenceRef)||!date(m.reviewedAt)||!date(asOf)||
   (date(asOf)&&date(m?.reviewedAt)&&Date.parse(m.reviewedAt)>Date.parse(asOf))||
   !m.discountRateComponents)
   blockers.push('SEPARATE_ENTRY_EXIT_DISCOUNT_RATE_REVIEW_REQUIRED');
 const components=m?.discountRateComponents;
 const names=['referenceRate','propertyRiskPremium','liquidityRiskPremium','otherRiskPremium'];
 if(!components||names.some(n=>!finite(components[n])||components[n]<0)||
    names.some(n=>!filled(m?.discountRateComponentEvidence?.[n])))blockers.push('EXPLICIT_DISCOUNT_RATE_DECOMPOSITION_REQUIRED');
 else if(finite(discountRate)&&Math.abs(names.reduce((s,n)=>s+components[n],0)-discountRate)*10000>
     policy.maxRateReconciliationErrorBps)blockers.push('DISCOUNT_RATE_COMPONENTS_DO_NOT_RECONCILE');
 if(m&&m.exitEvidenceRef===m.entryEvidenceRef&&!filled(m.independentExitSourceRationale))
   blockers.push('EXIT_RATE_DUPLICATES_ENTRY_SOURCE_WITHOUT_SEPARATE_RATIONALE');
 const capGovernance=(finite(entryCapRate)&&finite(exitCapRate))?
   evaluateEntryExitCapRateGovernance({
     entryCapRate,exitCapRate,requireExit:true,
     entryEvidence:{grade:EVIDENCE_GRADE.B_VERIFIED_TRANSACTION,status:INPUT_STATUS.UNVERIFIED,sourceType:'EXECUTED_MARKET_CAP',sourceRef:m?.entryEvidenceRef||'UNREVIEWED_ENTRY'},
     exitEvidence:{grade:EVIDENCE_GRADE.G_EXPERT_ASSUMPTION,status:INPUT_STATUS.UNVERIFIED,sourceType:'FORWARD_EXIT_CAP',sourceRef:m?.exitEvidenceRef||'UNREVIEWED_EXIT'},
     sameRateRationale:m?.sameRateRationale||null,
     capCompressionRationale:m?.capCompressionRationale||null,
   }) :null;
 if(capGovernance&&capGovernance.status===CAP_RATE_GOVERNANCE_STATUS.HOLD)
   blockers.push('EXISTING_ENTRY_EXIT_CAP_GOVERNANCE_HOLD');
 if(capGovernance)warnings.push(...capGovernance.warnings);
 if(finite(entryCapRate)&&finite(exitCapRate)&&entryCapRate===exitCapRate&&!filled(m?.sameRateRationale))
   blockers.push('SAME_ENTRY_EXIT_CAP_WITHOUT_INDEPENDENT_RATIONALE');
 if(finite(entryCapRate)&&finite(exitCapRate)&&exitCapRate<entryCapRate&&!filled(m?.capCompressionRationale))
   blockers.push('EXIT_CAP_COMPRESSION_NEEDS_PROFESSIONAL_RATIONALE');
 if(blockers.length)return fail(blockers,{qualifyingTransactions:rates.length,medianObservedCapRate:medianCap,warnings});
 const noiShock=policy.stressNoiShockPercent,capShock=policy.stressCapShockBps/10000;
 const stress=[
   {label:'BASE',noi:terminalNoiSar,rate:exitCapRate},
   {label:'LOW_NOI_HIGH_EXIT_CAP',noi:terminalNoiSar*(1-noiShock),rate:exitCapRate+capShock},
   {label:'HIGH_NOI_LOW_EXIT_CAP',noi:terminalNoiSar*(1+noiShock),rate:exitCapRate-capShock},
 ];
 if(stress.some(x=>x.rate<=0||x.rate>=1||x.noi<=0))
   return fail(['STRESS_RANGE_INVALID'],{qualifyingTransactions:rates.length,medianObservedCapRate:medianCap});
 const core={
   version:VERSION,status:STATUS.READY_FOR_EXTERNAL_AUTHENTICATION,
   assetClass,city,valuationDate,asOf,
   policy:{...policy},rateReviewEvidenceRefs:{
     entry:m.entryEvidenceRef,exit:m.exitEvidenceRef,discount:m.discountEvidenceRef,
   },
   comparablesCount:rates.length,
   sourceTransactionsFingerprintSha256:hash(rates),
   medianObservedCapRate:medianCap,
   entryCapRate,exitCapRate,discountRate,
   entryVsMedianBps:(entryCapRate-medianCap)*10000,
   entryExitSpreadBps:(exitCapRate-entryCapRate)*10000,
   discountRateComponents:{...components},
   terminalNoiSar,
   stressTerminalValuesSar:stress.map(x=>({scenario:x.label,terminalNoiSar:x.noi,exitCapRate:x.rate,
     terminalValueSar:x.noi/x.rate})),
   blockers:[],warnings,
   marketRateAccuracyIndependentlyEstablished:false,
   independentSaudiRateEvidenceVerified:false,
   professionalAppraisalEstablished:false,
   transactionAuthorized:false,productionDecisionAuthorized:false,
   semantics:'C60 reconciles annual NOI to real-sale price evidence, entry/exit cap assumptions and discount-rate component totals. The held-out source documents and rate policy must be independently authenticated; structural PASS does not establish true current Saudi capital markets rates or authorize commercial use.',
 };
 return freeze({...core,ratePackageHashSha256:hash(core)});
}
module.exports={VERSION,STATUS,assessMarketRateProvenance};
