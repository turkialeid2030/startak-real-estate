'use strict';
const PORTFOLIO_VERSION='PORTFOLIO_DECISION_COCKPIT_V1';
const PORTFOLIO_STATUS=Object.freeze({QUALIFIED:'QUALIFIED',REVIEW_REQUIRED:'REVIEW_REQUIRED',HOLD:'HOLD'});
function freeze(v){if(v&&typeof v==='object'&&!Object.isFrozen(v)){Object.freeze(v);Object.values(v).forEach(freeze);}return v;}
function finite(v){return typeof v==='number'&&Number.isFinite(v);}
function evaluatePortfolioDecision({assets,limits}={}){
 const blockers=[];
 if(!Array.isArray(assets)||!assets.length)blockers.push('PORTFOLIO_ASSETS_REQUIRED');
 if(!limits||!finite(limits.maxSingleAssetWeight)||!finite(limits.maxCityWeight)||!finite(limits.maxAssetTypeWeight)||!finite(limits.minPortfolioDscr))blockers.push('PORTFOLIO_LIMITS_REQUIRED');
 if(blockers.length)return freeze({version:PORTFOLIO_VERSION,status:PORTFOLIO_STATUS.HOLD,blockers,warnings:[],metrics:null,transactionAuthorized:false});
 let total=0,weightedNoi=0,weightedDebt=0;const cities={},types={},warnings=[];
 for(const a of assets){if(!a||!a.id||!finite(a.valueSar)||a.valueSar<=0||!finite(a.noiSar)||a.noiSar<0||!a.city||!a.assetType)return freeze({version:PORTFOLIO_VERSION,status:PORTFOLIO_STATUS.HOLD,blockers:[`INVALID_PORTFOLIO_ASSET:${a&&a.id?a.id:'UNKNOWN'}`],warnings:[],metrics:null,transactionAuthorized:false});total+=a.valueSar;weightedNoi+=a.noiSar;if(finite(a.annualDebtServiceSar)&&a.annualDebtServiceSar>0)weightedDebt+=a.annualDebtServiceSar;cities[a.city]=(cities[a.city]||0)+a.valueSar;types[a.assetType]=(types[a.assetType]||0)+a.valueSar;}
 const assetWeights=assets.map(a=>({id:a.id,weight:a.valueSar/total}));const cityWeights=Object.fromEntries(Object.entries(cities).map(([k,v])=>[k,v/total]));const assetTypeWeights=Object.fromEntries(Object.entries(types).map(([k,v])=>[k,v/total]));
 if(assetWeights.some(x=>x.weight>limits.maxSingleAssetWeight))warnings.push('SINGLE_ASSET_CONCENTRATION_BREACH');
 if(Object.values(cityWeights).some(x=>x>limits.maxCityWeight))warnings.push('CITY_CONCENTRATION_BREACH');
 if(Object.values(assetTypeWeights).some(x=>x>limits.maxAssetTypeWeight))warnings.push('ASSET_TYPE_CONCENTRATION_BREACH');
 const portfolioDscr=weightedDebt>0?weightedNoi/weightedDebt:null;if(portfolioDscr!==null&&portfolioDscr<limits.minPortfolioDscr)warnings.push('PORTFOLIO_DSCR_BREACH');
 return freeze({version:PORTFOLIO_VERSION,status:warnings.length?PORTFOLIO_STATUS.REVIEW_REQUIRED:PORTFOLIO_STATUS.QUALIFIED,blockers:[],warnings,metrics:{totalValueSar:total,totalNoiSar:weightedNoi,portfolioDscr,assetWeights,cityWeights,assetTypeWeights},humanDecisionRequired:true,transactionAuthorized:false,semantics:'Portfolio cockpit exposes concentration and debt-service diagnostics; it does not approve investments, dispose assets, or authorize transactions.'});
}
module.exports={PORTFOLIO_VERSION,PORTFOLIO_STATUS,evaluatePortfolioDecision};
