'use strict';
// Separately supplied opening portfolio snapshot; a content hash checks
// consistency, not issuer identity, source authenticity or ownership.
const {createPortfolioSnapshot,verifyPortfolioSnapshot,createPortfolioMember,PORTFOLIO_STATUS}=require('./portfolio-concentration');
const {strictCalendarDateMs}=require('../validation/strict-calendar-instant');
const MAX_BYTES=256*1024;
const date=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(strictCalendarDateMs(v));
const id=v=>typeof v==='string'&&/^[a-zA-Z0-9_.:-]{1,128}$/.test(v);
function validateOpeningPortfolioSnapshot(text,expected){
 if(typeof text!=='string'||new TextEncoder().encode(text).length>MAX_BYTES||!expected||!id(expected.portfolioId)||!date(expected.asOfDate))throw Error('PORTFOLIO_OPENING_SNAPSHOT_INVALID');
 const s=JSON.parse(text,(k,v)=>{if(['__proto__','constructor','prototype'].includes(k))throw Error('PORTFOLIO_OPENING_SNAPSHOT_INVALID');return v;});
 if(!s||s.portfolioId!==expected.portfolioId||!id(s.snapshotId)||s.currency!=='SAR'||!date(s.asOfDate)||s.asOfDate>=expected.asOfDate||s.weightBasis!=='CURRENT_EXPOSURE'||s.status!==PORTFOLIO_STATUS.READY_FOR_IC_EVIDENCE_ASSEMBLY||s.transactionAuthorized!==false||s.automaticInvestmentDecisionAuthorized!==false||!Array.isArray(s.members)||s.members.length<2||s.members.length>1000||!verifyPortfolioSnapshot(s).valid)throw Error('PORTFOLIO_OPENING_SNAPSHOT_INVALID');
 if(!Array.isArray(expected.assetIds)||expected.assetIds.length!==s.members.length||new Set(expected.assetIds).size!==expected.assetIds.length)throw Error('PORTFOLIO_OPENING_MEMBERSHIP_INVALID');
 // Enforce bounded independent reconciliation, rather than a permissive
 // tolerance chosen in an imported artifact. Only a homogeneous opening
 // professional-value basis is supported in this local research route.
 if(!Number.isFinite(s.weightTolerance)||s.weightTolerance<=0||s.weightTolerance>1e-9||!Number.isFinite(s.exposureWeightTolerance)||s.exposureWeightTolerance<=0||s.exposureWeightTolerance>1e-6)throw Error('PORTFOLIO_OPENING_TOLERANCE_INVALID');
 const members=s.members.map(m=>{
  if(!m||!id(m.assetId)||!expected.assetIds.includes(m.assetId)||m.exposureBasis!=='PROFESSIONAL_VALUE_INDICATION'||m.sourceAsOfDate!==s.asOfDate||!Number.isFinite(m.exposureAmount)||m.exposureAmount<=0||m.exposureAmount>1e12||createPortfolioMember(m).memberHashSha256!==m.memberHashSha256)throw Error('PORTFOLIO_OPENING_MEMBER_INVALID');
  return m;
 });
 const rebuilt=createPortfolioSnapshot({...s,members});
 if(rebuilt.snapshotHashSha256!==s.snapshotHashSha256||rebuilt.status!==PORTFOLIO_STATUS.READY_FOR_IC_EVIDENCE_ASSEMBLY)throw Error('PORTFOLIO_OPENING_RECONCILIATION_FAILED');
 return {portfolioId:s.portfolioId,snapshotId:s.snapshotId,snapshotHashSha256:s.snapshotHashSha256,periodStart:s.asOfDate,asOfDate:expected.asOfDate,assetIds:members.map(m=>m.assetId).sort(),openingValues:members.map(m=>({assetId:m.assetId,openingValue:m.exposureAmount}))};
}
function assertOpeningReturnMatch(input,scope){
 if(!input||input.periodStart!==scope.periodStart||!Array.isArray(input.members)||input.members.length!==scope.openingValues.length)throw Error('PORTFOLIO_OPENING_PERIOD_MISMATCH');
 for(const m of scope.openingValues){
  const match=input.members.find(x=>x?.assetId===m.assetId);
  if(!match||match.openingValue!==m.openingValue)throw Error('PORTFOLIO_OPENING_VALUE_MISMATCH');
 }
}
module.exports={validateOpeningPortfolioSnapshot,assertOpeningReturnMatch};
