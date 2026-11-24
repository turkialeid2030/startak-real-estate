'use strict';
// Historical actuals only. Not a valuation, accounting opinion, or authority to spend.
// Input grain: one property, one closed period, one consistent measurement basis.
const VERSION='REAL_ESTATE_EFFICIENCY_V1';
const MAX_BYTES=256*1024;
const GROUPS=Object.freeze({
 financial:Object.freeze(['effectiveRevenueSar','operatingExpensesSar','budgetRevenueSar','budgetOperatingExpensesSar','receivablesDueSar','collectionsAgainstDueSar','cashAvailableForDebtServiceSar','debtServiceSar']),
 operational:Object.freeze(['availableAreaDays','occupiedAreaDays','maintenanceDue','maintenanceOnTime','maintenanceExpenseSar']),
 productivity:Object.freeze(['maintenanceCompleted','maintenanceLaborHours','qualityEligibleCompleted','reopenedWithinReviewWindow','adminCompleted','adminLaborHours']),
 administrative:Object.freeze(['adminDue','adminOnTime','controlsDue','controlsCompletedOnTime'])
});
const OWNER=Object.freeze({financial:'FINANCE',operational:'ASSET_OPERATIONS',productivity:'OPERATIONS_AND_ADMIN',administrative:'GOVERNANCE'});
const COUNTS=new Set(['maintenanceDue','maintenanceOnTime','maintenanceCompleted','qualityEligibleCompleted','reopenedWithinReviewWindow','adminCompleted','adminDue','adminOnTime','controlsDue','controlsCompletedOnTime']);
const SIGNED=new Set(['cashAvailableForDebtServiceSar']);
const MAX=1e12;
const plain=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
const ref=v=>typeof v==='string'&&v.trim()===v&&v.length>0&&v.length<=160;
const date=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v;
const finite=v=>typeof v==='number'&&Number.isFinite(v);
const ratio=(a,b)=>finite(a)&&finite(b)&&b>0?a/b:null;
const delta=(a,b)=>finite(a)&&finite(b)?a-b:null;
const isPresent=v=>v!==null&&v!==undefined;
const hold=blockers=>({version:VERSION,status:'HOLD',blockers,metrics:[],coverage:null,sourceAuthenticityIndependentlyVerified:false,valuationChanged:false,transactionAuthorized:false,spendingAuthorized:false,productionAuthorized:false});
const defs=Object.freeze([
 ['operatingSurplus','financial','SAR','HIGHER',v=>delta(v.effectiveRevenueSar,v.operatingExpensesSar)],
 ['surplusMargin','financial','RATIO','HIGHER',v=>ratio(delta(v.effectiveRevenueSar,v.operatingExpensesSar),v.effectiveRevenueSar)],
 ['expenseRatio','financial','RATIO','LOWER',v=>ratio(v.operatingExpensesSar,v.effectiveRevenueSar)],
 ['revenueVariance','financial','SAR','HIGHER',v=>delta(v.effectiveRevenueSar,v.budgetRevenueSar)],
 ['expenseVariance','financial','SAR','LOWER',v=>delta(v.operatingExpensesSar,v.budgetOperatingExpensesSar)],
 ['collectionRate','financial','RATIO','HIGHER',v=>ratio(v.collectionsAgainstDueSar,v.receivablesDueSar)],
 ['cashDebtCoverage','financial','MULTIPLE','HIGHER',v=>ratio(v.cashAvailableForDebtServiceSar,v.debtServiceSar)],
 ['occupancy','operational','RATIO','HIGHER',v=>ratio(v.occupiedAreaDays,v.availableAreaDays)],
 ['maintenanceSla','operational','RATIO','HIGHER',v=>ratio(v.maintenanceOnTime,v.maintenanceDue)],
 ['maintenanceCostPerAvailableAreaDay','operational','SAR_PER_SQM_DAY','LOWER',v=>ratio(v.maintenanceExpenseSar,v.availableAreaDays)],
 ['maintenanceOutputPerHour','productivity','COUNT_PER_HOUR','HIGHER',v=>ratio(v.maintenanceCompleted,v.maintenanceLaborHours)],
 ['maintenanceReopenRate','productivity','RATIO','LOWER',v=>ratio(v.reopenedWithinReviewWindow,v.qualityEligibleCompleted)],
 ['adminOutputPerHour','productivity','COUNT_PER_HOUR','HIGHER',v=>ratio(v.adminCompleted,v.adminLaborHours)],
 ['adminSla','administrative','RATIO','HIGHER',v=>ratio(v.adminOnTime,v.adminDue)],
 ['controlTimeliness','administrative','RATIO','HIGHER',v=>ratio(v.controlsCompletedOnTime,v.controlsDue)]
]);
function evaluateEfficiency(input,expected={}){
 try{
  if(!plain(input)||!plain(expected))return hold(['EFFICIENCY_INPUT_REQUIRED']);
  const {caseId,propertyRef,marketScopeRef,periodStart,periodEnd,asOfDate,measurementBasisRef,groups,targets={}}=input;
  if(![caseId,propertyRef,marketScopeRef,measurementBasisRef].every(ref)||![periodStart,periodEnd,asOfDate].every(date)||periodStart>periodEnd||periodEnd>asOfDate)return hold(['EFFICIENCY_SCOPE_OR_PERIOD_INVALID']);
  if(!['caseId','propertyRef','marketScopeRef','asOfDate'].every(k=>expected[k]===input[k]))return hold(['EFFICIENCY_EXPECTED_SCOPE_MISMATCH']);
  if(!plain(groups)||!plain(targets)||Object.keys(groups).some(k=>!Object.hasOwn(GROUPS,k)))return hold(['EFFICIENCY_GROUP_SCHEMA_INVALID']);
  const values={},lineage={},errors=[];
  for(const [group,fields] of Object.entries(GROUPS)){
   const entry=groups[group];
   if(entry===undefined||entry===null){fields.forEach(k=>values[k]=null);continue;}
   if(!plain(entry)||!plain(entry.values)||!ref(entry.sourceRef)||!date(entry.reviewedAt)||entry.reviewedAt<periodEnd||entry.reviewedAt>asOfDate||entry.measurementBasisRef!==measurementBasisRef||entry.periodStart!==periodStart||entry.periodEnd!==periodEnd){errors.push('EFFICIENCY_EVIDENCE_SCOPE:'+group);continue;}
   if(Object.keys(entry.values).some(k=>!fields.includes(k))){errors.push('EFFICIENCY_UNKNOWN_FIELD:'+group);continue;}
   lineage[group]={sourceRef:entry.sourceRef,reviewedAt:entry.reviewedAt,measurementBasisRef,periodStart,periodEnd};
   for(const k of fields){
    const v=entry.values[k];
    if(!isPresent(v)){values[k]=null;continue;}
    if(!finite(v)||Math.abs(v)>MAX||(!SIGNED.has(k)&&v<0)||(COUNTS.has(k)&&!Number.isSafeInteger(v)))errors.push('EFFICIENCY_INVALID_VALUE:'+k);
    else values[k]=v;
   }
  }
  for(const [a,b] of [['collectionsAgainstDueSar','receivablesDueSar'],['occupiedAreaDays','availableAreaDays'],['maintenanceOnTime','maintenanceDue'],['reopenedWithinReviewWindow','qualityEligibleCompleted'],['qualityEligibleCompleted','maintenanceCompleted'],['adminOnTime','adminDue'],['controlsCompletedOnTime','controlsDue']]){
   if(finite(values[a])&&finite(values[b])&&values[a]>values[b])errors.push('EFFICIENCY_COHORT_EXCEEDS_DENOMINATOR:'+a);
  }
  for(const [output,hours] of [['maintenanceCompleted','maintenanceLaborHours'],['adminCompleted','adminLaborHours']])if(values[hours]===0&&values[output]>0)errors.push('EFFICIENCY_OUTPUT_WITH_ZERO_HOURS:'+output);
  for(const [key,target] of Object.entries(targets)){
   if(!defs.some(d=>d[0]===key)||!plain(target)||!finite(target.value)||Math.abs(target.value)>MAX||!ref(target.sourceRef)||!date(target.approvedAt)||target.approvedAt>periodStart)errors.push('EFFICIENCY_INVALID_TARGET:'+key);
   else {const d=defs.find(x=>x[0]===key);if(d[2]==='RATIO'&&key!=='surplusMargin'&&(target.value<0||(['collectionRate','occupancy','maintenanceSla','maintenanceReopenRate','adminSla','controlTimeliness'].includes(key)&&target.value>1)))errors.push('EFFICIENCY_INVALID_TARGET_RANGE:'+key);}
  }
  if(errors.length)return hold(errors);
  const metrics=defs.map(([id,axis,unit,direction,calc])=>{
   const value=calc(values),target=targets[id]||null;
   const usable=finite(value);
   const variance=usable&&target?value-target.value:null;
   const status=!usable?'UNAVAILABLE':!target?'NOT_TARGETED':(direction==='HIGHER'?variance>=0:variance<=0)?'ON_TARGET':'OFF_TARGET';
   return {id,axis,unit,direction,ownerRole:OWNER[axis],value:usable?value:null,target:target?target.value:null,targetSourceRef:target?.sourceRef??null,variance,status,sourceRef:lineage[axis]?.sourceRef??null};
  });
  const available=metrics.filter(x=>x.value!==null).length;
  const warnings=[];
  if(values.debtServiceSar===0)warnings.push('NO_DEBT_SERVICE_COVERAGE_NOT_APPLICABLE');
  if(values.effectiveRevenueSar===0)warnings.push('ZERO_REVENUE_MARGIN_UNAVAILABLE');
  if(values.operatingExpensesSar===0)warnings.push('ZERO_EXPENSE_REQUIRES_REVIEW');
  if(metrics.find(x=>x.id==='maintenanceOutputPerHour').value!==null&&metrics.find(x=>x.id==='maintenanceReopenRate').value===null)warnings.push('PRODUCTIVITY_WITHOUT_QUALITY_GUARDRAIL');
  if(values.maintenanceExpenseSar!==null&&values.operatingExpensesSar!==null&&finite(values.maintenanceExpenseSar)&&finite(values.operatingExpensesSar)&&values.maintenanceExpenseSar>values.operatingExpensesSar)warnings.push('MAINTENANCE_EXPENSE_EXCEEDS_REPORTED_OPEX_CHECK_CLASSIFICATION');
  return {version:VERSION,status:available===0?'NO_MEASURABLE_KPI':available===metrics.length?'COMPLETE_RESEARCH_REVIEW':'PARTIAL_RESEARCH_REVIEW',blockers:[],caseId,propertyRef,marketScopeRef,periodStart,periodEnd,asOfDate,measurementBasisRef,coverage:{available,total:metrics.length,targeted:metrics.filter(x=>x.target!==null&&x.value!==null).length},lineage,metrics,warnings,sourceAuthenticityIndependentlyVerified:false,accountingOpinionEstablished:false,valuationChanged:false,transactionAuthorized:false,spendingAuthorized:false,productionAuthorized:false};
 }catch{return hold(['EFFICIENCY_INPUT_INVALID']);}
}
function reviewEfficiencyText({text,...expected}={}){
 try{
  if(typeof text!=='string'||new TextEncoder().encode(text).length>MAX_BYTES)return hold(['EFFICIENCY_FILE_LIMIT']);
  const input=JSON.parse(text,(k,v)=>{if(['__proto__','constructor','prototype'].includes(k))throw Error('unsafe');return v;});
  return evaluateEfficiency(input,expected);
 }catch{return hold(['EFFICIENCY_JSON_INVALID']);}
}
module.exports={VERSION,MAX_BYTES,GROUPS,evaluateEfficiency,reviewEfficiencyText};
