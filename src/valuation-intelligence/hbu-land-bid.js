'use strict';
const HBU_VERSION='HBU_LAND_BID_V2';
const HBU_STATUS=Object.freeze({QUALIFIED:'QUALIFIED',REVIEW_REQUIRED:'REVIEW_REQUIRED',HOLD:'HOLD'});
function freeze(v){if(v&&typeof v==='object'&&!Object.isFrozen(v)){Object.freeze(v);Object.values(v).forEach(freeze);}return v;}
function finite(v){return typeof v==='number'&&Number.isFinite(v);}
function nonEmpty(v){return typeof v==='string'&&v.trim().length>0;}
function evaluateHighestAndBestUse({alternatives,landAreaSqm,requiredDeveloperMarginRate,acquisitionCostsRate=0,evidenceComplete=false}={}){
 const blockers=[];
 if(!Array.isArray(alternatives)||!alternatives.length)blockers.push('HBU_ALTERNATIVES_REQUIRED');
 if(!finite(landAreaSqm)||landAreaSqm<=0)blockers.push('LAND_AREA_REQUIRED');
 if(!finite(requiredDeveloperMarginRate)||requiredDeveloperMarginRate<0||requiredDeveloperMarginRate>=1)blockers.push('DEVELOPER_MARGIN_RATE_INVALID');
 if(!finite(acquisitionCostsRate)||acquisitionCostsRate<0||acquisitionCostsRate>=1)blockers.push('ACQUISITION_COST_RATE_INVALID');
 if(evidenceComplete!==true)blockers.push('HBU_EVIDENCE_INCOMPLETE');
 if(blockers.length)return freeze({version:HBU_VERSION,status:HBU_STATUS.HOLD,blockers,warnings:[],alternatives:[],selected:null,transactionAuthorized:false});
 const results=[];let review=false;const ids=new Set();
 for(const a of alternatives){
  if(!a||!nonEmpty(a.id)||ids.has(a.id))return freeze({version:HBU_VERSION,status:HBU_STATUS.HOLD,blockers:[`INVALID_OR_DUPLICATE_ALTERNATIVE_ID:${a&&a.id?a.id:'UNKNOWN'}`],warnings:[],alternatives:results,selected:null,transactionAuthorized:false});
  ids.add(a.id);
  if(typeof a.legallyPermissible!=='boolean'||typeof a.physicallyPossible!=='boolean')return freeze({version:HBU_VERSION,status:HBU_STATUS.HOLD,blockers:[`HBU_GATE_EVIDENCE_INVALID:${a.id}`],warnings:[],alternatives:results,selected:null,transactionAuthorized:false});
  if(!a.legallyPermissible||!a.physicallyPossible){results.push({id:a.id,eligible:false,reason:'LEGAL_OR_PHYSICAL_GATE_FAILED'});continue;}
  if(!finite(a.grossDevelopmentValueSar)||a.grossDevelopmentValueSar<=0)return freeze({version:HBU_VERSION,status:HBU_STATUS.HOLD,blockers:[`INVALID_ALTERNATIVE_GDV:${a.id}`],warnings:[],alternatives:results,selected:null,transactionAuthorized:false});
  const costFields=['hardCostsSar','softCostsSar','financeCostsSar','contingencySar','sellingCostsSar'];
  if(costFields.some(k=>!finite(a[k])||a[k]<0))return freeze({version:HBU_VERSION,status:HBU_STATUS.HOLD,blockers:[`INVALID_ALTERNATIVE_INPUT:${a.id}`],warnings:[],alternatives:results,selected:null,transactionAuthorized:false});
  const nonLandCost=a.hardCostsSar+a.softCostsSar+a.financeCostsSar+a.contingencySar+a.sellingCostsSar;
  const requiredProfit=a.grossDevelopmentValueSar*requiredDeveloperMarginRate;
  const residualBeforeAcquisition=a.grossDevelopmentValueSar-nonLandCost-requiredProfit;
  const maximumLandBidSar=residualBeforeAcquisition/(1+acquisitionCostsRate);
  const bidPerSqmSar=maximumLandBidSar/landAreaSqm;
  const financiallyFeasible=maximumLandBidSar>0;
  if(!financiallyFeasible)review=true;
  results.push({id:a.id,eligible:true,financiallyFeasible,grossDevelopmentValueSar:a.grossDevelopmentValueSar,nonLandCostSar:nonLandCost,requiredProfitSar:requiredProfit,residualBeforeAcquisitionSar:residualBeforeAcquisition,maximumLandBidSar,bidPerSqmSar});
 }
 const feasible=results.filter(r=>r.eligible&&r.financiallyFeasible).sort((x,y)=>y.maximumLandBidSar-x.maximumLandBidSar);
 if(!feasible.length)return freeze({version:HBU_VERSION,status:HBU_STATUS.REVIEW_REQUIRED,blockers:[],warnings:['NO_FINANCIALLY_FEASIBLE_HBU'],alternatives:results,selected:null,transactionAuthorized:false,humanDecisionRequired:true});
 const selected=feasible[0];
 return freeze({version:HBU_VERSION,status:review?HBU_STATUS.REVIEW_REQUIRED:HBU_STATUS.QUALIFIED,blockers:[],warnings:review?['ONE_OR_MORE_HBU_ALTERNATIVES_NOT_FEASIBLE']:[],alternatives:results,selected,transactionAuthorized:false,humanDecisionRequired:true,semantics:'Maximum land bid is a residual feasibility ceiling under declared assumptions; it is not market value, an offer, investment approval, or transaction authority.'});
}
module.exports={HBU_VERSION,HBU_STATUS,evaluateHighestAndBestUse};
