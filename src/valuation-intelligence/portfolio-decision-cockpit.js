'use strict';
const PORTFOLIO_VERSION='PORTFOLIO_DECISION_COCKPIT_V3';
const PORTFOLIO_STATUS=Object.freeze({QUALIFIED:'QUALIFIED',REVIEW_REQUIRED:'REVIEW_REQUIRED',HOLD:'HOLD'});
function freeze(v){if(v&&typeof v==='object'&&!Object.isFrozen(v)){Object.freeze(v);Object.values(v).forEach(freeze);}return v;}
function finite(v){return typeof v==='number'&&Number.isFinite(v);}
function validLimit(v){return finite(v)&&v>=0&&v<=1;}
function nonEmpty(v){return typeof v==='string'&&v.trim().length>0;}
function evaluatePortfolioDecision({assets,limits}={}){
 const blockers=[];
 if(!Array.isArray(assets)||!assets.length)blockers.push('PORTFOLIO_ASSETS_REQUIRED');
 if(!limits||!validLimit(limits.maxSingleAssetWeight)||!validLimit(limits.maxCityWeight)||!validLimit(limits.maxAssetTypeWeight)||!finite(limits.minPortfolioDscr)||limits.minPortfolioDscr<0)blockers.push('PORTFOLIO_LIMITS_REQUIRED');
 if(blockers.length)return freeze({version:PORTFOLIO_VERSION,status:PORTFOLIO_STATUS.HOLD,blockers,warnings:[],metrics:null,transactionAuthorized:false});
 let total=0,totalNoi=0,totalDebtService=0;const cities=new Map(),types=new Map(),warnings=[],ids=new Set();
 for(const a of assets){
  const id=nonEmpty(a&&a.id)?a.id.trim():null;
  const city=nonEmpty(a&&a.city)?a.city.trim():null;
  const assetType=nonEmpty(a&&a.assetType)?a.assetType.trim():null;
  if(!a||!id||ids.has(id)||!finite(a.valueSar)||a.valueSar<=0||!finite(a.noiSar)||a.noiSar<0||!city||!assetType)return freeze({version:PORTFOLIO_VERSION,status:PORTFOLIO_STATUS.HOLD,blockers:[`INVALID_OR_DUPLICATE_PORTFOLIO_ASSET:${id||'UNKNOWN'}`],warnings:[],metrics:null,transactionAuthorized:false});
  ids.add(id);
  if(a.annualDebtServiceSar!==undefined&&a.annualDebtServiceSar!==null&&(!finite(a.annualDebtServiceSar)||a.annualDebtServiceSar<0))return freeze({version:PORTFOLIO_VERSION,status:PORTFOLIO_STATUS.HOLD,blockers:[`INVALID_DEBT_SERVICE:${id}`],warnings:[],metrics:null,transactionAuthorized:false});
  total+=a.valueSar;totalNoi+=a.noiSar;
  if(finite(a.annualDebtServiceSar)&&a.annualDebtServiceSar>0)totalDebtService+=a.annualDebtServiceSar;
  cities.set(city,(cities.get(city)||0)+a.valueSar);
  types.set(assetType,(types.get(assetType)||0)+a.valueSar);
 }
 const assetWeights=assets.map(a=>({id:a.id.trim(),weight:a.valueSar/total}));
 const cityWeights=Object.fromEntries([...cities.entries()].map(([k,v])=>[k,v/total]));
 const assetTypeWeights=Object.fromEntries([...types.entries()].map(([k,v])=>[k,v/total]));
 if(assetWeights.some(x=>x.weight>limits.maxSingleAssetWeight))warnings.push('SINGLE_ASSET_CONCENTRATION_BREACH');
 if(Object.values(cityWeights).some(x=>x>limits.maxCityWeight))warnings.push('CITY_CONCENTRATION_BREACH');
 if(Object.values(assetTypeWeights).some(x=>x>limits.maxAssetTypeWeight))warnings.push('ASSET_TYPE_CONCENTRATION_BREACH');
 const portfolioDscr=totalDebtService>0?totalNoi/totalDebtService:null;
 if(portfolioDscr!==null&&portfolioDscr<limits.minPortfolioDscr)warnings.push('PORTFOLIO_DSCR_BREACH');
 return freeze({version:PORTFOLIO_VERSION,status:warnings.length?PORTFOLIO_STATUS.REVIEW_REQUIRED:PORTFOLIO_STATUS.QUALIFIED,blockers:[],warnings,metrics:{totalValueSar:total,totalNoiSar:totalNoi,totalDebtServiceSar:totalDebtService,portfolioDscr,debtServiceCoverageScope:'PORTFOLIO_AGGREGATE',assetWeights,cityWeights,assetTypeWeights},humanDecisionRequired:true,transactionAuthorized:false,semantics:'Portfolio cockpit exposes aggregate concentration and debt-service diagnostics; it assumes portfolio NOI is available at the aggregate scope for portfolio DSCR and does not approve investments, dispose assets, or authorize transactions.'});
}
module.exports={PORTFOLIO_VERSION,PORTFOLIO_STATUS,evaluatePortfolioDecision};
