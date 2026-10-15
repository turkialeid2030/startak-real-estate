'use strict';
const CATEGORIES=Object.freeze(['FINANCING','TAX','DEPOSIT','FEES','OTHER']);
const REVIEW_STATES=Object.freeze(['NOT_REVIEWED','ENTERED','NONE_EXPECTED']);
const fail=code=>{throw new TypeError(code);};
const text=v=>typeof v==='string'&&v.trim().length>0&&v.length<=500;
const validDate=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
function validateCashOtherFlows(plan,receiptReferences=[]){
  if(!plan||plan.schemaVersion!==1||!Array.isArray(plan.entries)||plan.entries.length>2000||!Array.isArray(plan.categoryReviews)||plan.categoryReviews.length!==CATEGORIES.length)fail('CASH_OTHER_FLOWS_INVALID');
  const seen=new Set(receiptReferences);let total=0n;
  const entries=plan.entries.map(e=>{
    if(!e||!CATEGORIES.includes(e.category)||!['INFLOW','OUTFLOW'].includes(e.direction))fail('CASH_OTHER_FLOW_CLASSIFICATION_REQUIRED');
    if(!validDate(e.date))fail('CASH_DATE_INVALID');
    if(!Number.isSafeInteger(e.amountMinor)||e.amountMinor<=0)fail('CASH_AMOUNT_INVALID');
    if(!text(e.reference)||seen.has(e.reference.trim()))fail('CASH_UNIQUE_REFERENCE_REQUIRED');
    if(!text(e.sourceRef)||!text(e.description))fail('CASH_OTHER_FLOW_SOURCE_REQUIRED');
    seen.add(e.reference.trim());total+=BigInt(e.amountMinor);
    if(total>BigInt(Number.MAX_SAFE_INTEGER))fail('CASH_AMOUNT_OUT_OF_RANGE');
    return {category:e.category,direction:e.direction,date:e.date,amountMinor:e.amountMinor,reference:e.reference.trim(),sourceRef:e.sourceRef.trim(),description:e.description.trim()};
  });
  const reviews=new Map();
  for(const r of plan.categoryReviews){
    if(!r||!CATEGORIES.includes(r.category)||reviews.has(r.category)||!REVIEW_STATES.includes(r.status))fail('CASH_CATEGORY_REVIEW_INVALID');
    const count=entries.filter(e=>e.category===r.category).length;
    if((r.status==='ENTERED'&&!count)||(r.status==='NONE_EXPECTED'&&count))fail('CASH_CATEGORY_REVIEW_CONFLICT');
    reviews.set(r.category,r.status);
  }
  return {schemaVersion:1,entries,categoryReviews:CATEGORIES.map(category=>({category,status:reviews.get(category)}))};
}
function cashOtherFlowCoverage(plan){
  const categories=CATEGORIES.map(category=>{
    const entries=(plan?.entries||[]).filter(e=>e.category===category);
    const sum=direction=>Number(entries.filter(e=>e.direction===direction).reduce((s,e)=>s+BigInt(e.amountMinor),0n));
    return {category,reviewStatus:plan?.categoryReviews.find(r=>r.category===category)?.status||'NOT_REVIEWED',entryCount:entries.length,inflowsMinor:sum('INFLOW'),outflowsMinor:sum('OUTFLOW')};
  });
  const reviewedCategoryCount=categories.filter(r=>r.reviewStatus!=='NOT_REVIEWED').length;
  return {status:reviewedCategoryCount===CATEGORIES.length?'REVIEW_DECLARED':'REVIEW_INCOMPLETE',categories,reviewedCategoryCount,totalCategories:CATEGORIES.length,coverageComplete:false,
    semantics:'User-declared review of additional flow categories for this horizon. NONE_EXPECTED is an explicit assumption, not a missing value. Sources, completeness, tax treatment and funding availability are not independently verified; no bank or professional approval is established.'};
}
module.exports={CASH_OTHER_FLOW_CATEGORIES:CATEGORIES,CASH_CATEGORY_REVIEW_STATES:REVIEW_STATES,validateCashOtherFlows,cashOtherFlowCoverage};
