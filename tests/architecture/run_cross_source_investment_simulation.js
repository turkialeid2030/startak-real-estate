'use strict';
// Synthetic cross-source owner acceptance simulation. NO live websites are scraped,
// no Saudi sale/title/authentication is claimed, and no commercial advice is issued.
const assert=require('node:assert/strict');
const {parseListingResearchCsv}=require('../../src/market/saudi-listing-source-research');
const {importNationalSourcesCsv,OFFICIAL_RESEARCH_ENTRYPOINTS}=
 require('../../src/market/saudi-national-intelligence-sources');
const {importEarthResearchCsv}=require('../../src/market/earth-national-research');
const {buildUnifiedResearch,researchReportBundle,researchClaimsGate}=
 require('../../src/market/research-evidence-fusion');
const {renderResearchBriefHtml}=require('../../src/market/research-brief-html');
const {calculateResearchErrorMetrics,validateIndependentHoldout}=
 require('../../src/market/appraisal-market-validation');
const {parseNumericText}=require('../../src/validation/numeric-text');
const {preciseNPV,preciseIRR}=require('../../src/engines/financial/precision');
let checks=0;const ok=(expr,label)=>{assert.ok(expr,label);checks++;};
const day='2026-10-28';
const listings=parseListingResearchCsv([
 'source,city,district,kind,priceSar,areaSqm,listingUrl,listingId,assetType,listingDate',
 'عقار,الرياض,الملقا,SALE_OFFER,1500000,300,https://sa.aqar.fm/p/synthetic-1,SYN-L-1,VILLA,2026-10-25',
 'حراج,الرياض,الملقا,SALE_OFFER,1500000,300,https://haraj.com.sa/p/synthetic-2,SYN-L-2,VILLA,2026-10-25',
 'عقار,جدة,الصفا,SALE_OFFER,2200000,300,https://sa.aqar.fm/p/synthetic-3,SYN-L-3,VILLA,2026-10-25',
 'عقار,الرياض,الملقا,SALE_OFFER,1900000,300,https://sa.aqar.fm.evil.invalid/p/synthetic-4,SYN-L-4,VILLA,2026-10-25',
].join('\n'),{observedOn:day});
ok(listings.records.length===3,'listing URL domain spoofing must be rejected');
ok(listings.rejected.length===1,'spoofed listing is rejected with no numeric promotion');
const national=importNationalSourcesCsv([
 'source,city,district,kind,recordId,eventDate,periodStart,periodEnd,metricName,metricValue,unit,sourceUrl,assetType',
 'REGA_REI,الرياض,الملقا,OFFICIAL_AGGREGATE,,,2026-01-01,2026-03-31,deal_count,20,COUNT,https://rei.rega.gov.sa/ar,LAND',
 'MOJ_SREM,الرياض,الملقا,OFFICIAL_REPORTED_SALE,SYN-T-1,2026-10-22,,,sale_price_sar,2000000,SAR,https://srem.moj.gov.sa/,LAND',
 'REGA_REI,جدة,الصفا,OFFICIAL_AGGREGATE,,,2026-01-01,2026-03-31,deal_count,40,COUNT,https://rei.rega.gov.sa/ar,LAND'
].join('\n'),{observedOn:day});
ok(national.records.length===3,'synthetic official-category records parsed as user CSV only');
ok(national.records.every(x=>x.executedTransactionRecord===false&&x.marketValuationEligible===false),
 'public source branding must not certify an imported record');
const earth=importEarthResearchCsv(
 'city,district,recordId,eventDate,amountSar,areaSqm,planNumber,parcelNumber\n'+
 'الرياض,الملقا,SYN-T-1,2026-10-22,2000000,400,P-1,L-1',
 {featureId:'TRANSACTION_TABLE',observedOn:day});
ok(earth.records.length===1,'synthetic Earth record imported unverified');
const subject={city:'الرياض',district:'الملقا',assetType:'LAND'};
const snap=buildUnifiedResearch({subject,asOf:day,
 feeds:{listings:listings.records,national:national.records,earth:earth.records}});
ok(snap.status==='HOLD_UNVERIFIED_PERSONAL_RESEARCH','full research retains HOLD');
ok(snap.subjectAreaRows===5,'Riyadh Malqa research must exclude Jeddah');
ok(snap.verifiedExecutedSales===0,'reported transaction cannot be promoted to verified sale');
ok(snap.certifiedMarketValueSar===null&&snap.investorMaximumPurchaseSar===null,
 'no certified value or price ceiling from mixed unverified sources');
ok(snap.possibleCrossSourceDuplicates.some(x=>x.reason==='POTENTIAL_CROSS_PORTAL_SAME_OFFER'),
 'same listing across portals is flagged');
ok(snap.possibleCrossSourceDuplicates.some(x=>x.reason==='POTENTIAL_REPEATED_REPORTED_SALE'),
 'same reported transaction across providers is flagged');
ok(snap.context.every(x=>!x.professionalComparableSelected&&!x.eligibleForFinancialCalculation),
 'unverified research never enters the economic engine as comparable');
const earlier=buildUnifiedResearch({subject,asOf:'2026-10-20',
 feeds:{listings:listings.records,national:national.records,earth:earth.records}});
ok(earlier.subjectAreaRows===0&&earlier.risks.includes('POST_ASOF_RESEARCH_EXCLUDED'),
 'as-of barrier excludes all records only observed after the historical decision date');
const bundle=researchReportBundle(snap,{marketReadinessStatus:'HOLD'});
ok(bundle.valuationSar===null&&bundle.maximumPurchaseSar===null&&
 bundle.publishableProfessionalValuation===false,'report bundle blocks licensed appraisal');
const html=renderResearchBriefHtml(bundle);
ok(html.includes('dir="rtl"')&&html.includes('HOLD'),'Arabic HTML is RTL and bounded by HOLD');
ok(!html.includes('<script'),'HTML report does not emit active scripts');
const claim=researchClaimsGate({snapshot:snap,claims:[
 {kind:'OBSERVATION',text:'توصية نهائية بالشراء',evidenceIds:[snap.context[0].evidenceId]}]});
ok(claim.status==='REJECTED','AI research text cannot authorize purchase');
const p=parseNumericText('١٬٨٠٠٫٥');
ok(p.ok&&p.value===1800.5,'Arabic decimal is not silently magnified');
ok(!parseNumericText('1e3').ok&&!parseNumericText('١٬٨٠٠٫٥٫٠').ok,
 'malformed draft and scientific inputs rejected');
const arith=calculateResearchErrorMetrics([
 {predictedValueSar:110,executedPriceSar:100},
 {predictedValueSar:90,executedPriceSar:100}]);
ok(arith.count===2&&arith.maeSar===10&&arith.mapePct===10,
 'synthetic holdout error arithmetic is deterministic');
const falseProof=validateIndependentHoldout({observations:[{
 propertyRef:'SYN-1',assetType:'LAND',city:'الرياض',district:'الملقا',
 predictedValueSar:110,executedPriceSar:100,
 predictedAsOf:'2026-01-01',executionDate:'2026-01-02',
 executedTransactionConfirmed:false,independentlyVerified:false,reuseRightsVerified:false,
 observationSourceType:'EXECUTED_REAL_ESTATE_TRANSACTION'}]});
ok(falseProof.publishableAccuracyClaim===false&&falseProof.validObservations===0,
 'unverified synthetic sample never claims market accuracy');
ok(Math.abs(preciseNPV(0,[-1000000,1200000])-200000)<0.01,'NPV deterministic cashflow');
ok(Math.abs(preciseIRR([-1000000,1200000])-0.2)<1e-7,'IRR deterministic cashflow');
ok(OFFICIAL_RESEARCH_ENTRYPOINTS.length===4&&
 OFFICIAL_RESEARCH_ENTRYPOINTS.every(x=>x.liveApiConnected===false&&
 x.marketValuationEligible===false),'official links are not misrepresented as live API');
console.log('STARTAK_CROSS_SOURCE_INTEGRATION_SIMULATION=PASS checks='+checks+
 ' scenario=RIYADH_MALQA_WITH_JEDDA_EXCLUSION syntheticOnly=true liveOfficialAPI=false professionalGO=false');
