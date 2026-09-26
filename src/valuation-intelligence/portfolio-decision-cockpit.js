'use strict';
const PORTFOLIO_VERSION='PORTFOLIO_DECISION_COCKPIT_V2';
const PORTFOLIO_STATUS=Object.freeze({QUALIFIED:'QUALIFIED',REVIEW_REQUIRED:'REVIEW_REQUIRED',HOLD:'HOLD'});
function freeze(v){if(v&&typeof v==='object'&&!Object.isFrozen(v)){Object.freeze(v);Object.values(v).forEach(freeze);}return v;}
function finite(v){return typeof v==='number'&&Number.isFinite(v);}
function validLimit(v){return finite(v)&&v>=0&&v<=1;}
function evaluatePortfolioDecision({assets,limits}={}){
 const blockers=[];
 if(!Array.isArray(assets)||!assets.length)blockers.push('PORTFOLIO_ASSETS_REQUIRED');
 if(!limits||!validLimit(limits.maxSingleAssetWeight)||!validLimit(limits.maxCityWeight)||!validLimit(limits.maxAssetTypeWeight)||!finite(limits.minPortfolioDscr)||limits.minPortfolioDscr<0)blockers.push('PORTFOLIO_LIMITS_REQUIRED');
 if(blockers.length)return freeze({version:PORTFOLIO_VERSION,status:PORTFOLIO_STATUS.HOLD,blockers,warnings:[],metrics:null,transactionAuthorized:false});
 let total=0,totalNoi=0,totalDebtService=0;const cities={},types={},warnings=[],ids=new Set();
 for(const a of assets){
  if(!a||!a.id||ids.has(a.id)||!finite(a.valueSar)||a.valueSar<=0||!finite(a.noiSar)||a.noiSar<0||!a.city||!a.assetType)return freeze({version:PORTFOLIO_VERSION,status:PORTFOLIO_STATUS.HOLD,blockers:[`INVALID_OR_DUPLICATE_PORTFOLIO_ASSET:${a&&a.id?a.id:'UNKNOWN'}`],warnings:[],metrics:null,transactionAuthorized:false});
  ids.add(a.id);
  if(a.annualDebtServiceSar!==undefined&&a.annualDebtServiceSar!==null&&(!finite(a.annualDebtServiceSar)||a.annualDebtServiceSar<0))return freeze({version:PORTFOLIO_VERSION,status:PORTFOLIO_STATUS.HOLD,blockers:[`INVALID_DEBT_SERVICE:${a.id}`],warnings:[],metrics:null,transactionAuthorized:false});
  total+=a.valueSar;totalNoi+=a.noiSar;
  if(finite(a.annualDebtServiceSar)&&a.annualDebtServiceSar>0)totalDebtService+=a.annualDebtServiceSar;
  cities[a.city]=(cities[a.city]||0)+a.valueSar;
  types[a.assetType]=(types[a.assetType]||0)+a.valueSar;
 }
 const assetWeights=assets.map(a=>({id:a.id,weight:a.valueSar/total}));
 const cityWeights=Object.fromEntries(Object.entries(cities).map(([k,v])=>[k,v/total]));
 const assetTypeWeights=Object.fromEntries(Object.entries(types).map(([k,v])=>[k,v/total]));
 if(assetWeights.some(x=>x.weight>limits.maxSingleAssetWeight))warnings.push('SINGLE_ASSET_CONCENTRATION_BREACH');
 if(Object.values(cityWeights).some(x=>x>limits.maxCityWeight))warnings.push('CITY_CONCENTRATION_BREACH');
 if(Object.values(assetTypeWeights).some(x=>x>limits.maxAssetTypeWeight))warnings.push('ASSET_TYPE_CONCENTRATION_BREACH');
 const portfolioDscr=totalDebtService>0?totalNoi/totalDebtService:null;
 if(portfolioDscr!==null&&portfolioDscr<limits.minPortfolioDscr)warnings.push('PORTFOLIO_DSCR_BREACH');
 return freeze({version:PORTFOLIO_VERSION,status:warnings.length?PORTFOLIO_STATUS.REVIEW_REQUIRED:PORTFOLIO_STATUS.QUALIFIED,blockers:[],warnings,metrics:{totalValueSar:total,totalNoiSar:totalNoi,totalDebtServiceSar:totalDebtService,portfolioDscr,assetWeights,cityWeights,assetTypeWeights},humanDecisionRequired:true,transactionAuthorized:false,semantics:'Portfolio cockpit exposes concentration and debt-service diagnostics; it does not approve investments, dispose assets, or authorize transactions.'});
}
module.exports={PORTFOLIO_VERSION,PORTFOLIO_STATUS,evaluatePortfolioDecision};
