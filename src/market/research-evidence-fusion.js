'use strict';
// Non-certifying, source-aware evidence join across existing STARTAK research panels.
// All research records remain untrusted; no numbers may be promoted to professional
// comparables, executed sales, authenticated deeds or investment approvals here.
const {SOURCE_MAP}=require('./saudi-listing-source-research');
const {BY_FEATURE}=require('./earth-national-research');
const {BY_ID}=require('./saudi-national-intelligence-sources');
const {containsProhibitedDecisionLanguage}=require('../decision-intelligence/ai-expert-orchestrator');
const VERSION='STARTAK_RESEARCH_FUSION_V1';
const MAX_ROWS=12000;
const norm=v=>String(v??'').trim().replace(/[أإآٱ]/g,'ا').replace(/ة/g,'ه')
 .replace(/ى/g,'ي').replace(/\s+/g,' ').toLowerCase();
const short=v=>String(v??'').trim().slice(0,160);
const finite=v=>typeof v==='number'&&Number.isFinite(v)?v:null;
const dated=v=>typeof v==='string'&&/^\d{4}-\d\d-\d\d$/.test(v)&&
 Number.isFinite(Date.parse(v+'T00:00:00Z'))&&
 new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v;
// Stable, transparent research citation IDs; NOT signatures or external verification.
function researchEvidenceId(feed,x){
 const values=[x.origin,x.type,x.ref,x.city,x.district,x.observedOn,
  x.eventDate||'',x.transactionId||'',x.assetType||'',x.planNumber||'',
  x.parcelNumber||'',x.priceOrMetricSar??'',x.areaSqm??''];
 return feed+':'+values.map(v=>encodeURIComponent(String(v).slice(0,2200))).join('|');
}
function sourceUrl(v){
 try{const u=new URL(v);if(u.protocol!=='https:'||u.username||u.password||!u.hostname.includes('.'))
   return null;return u.toString();}catch{return null;}
}
function fromResearchFeeds(feeds={}){
 if(!feeds||typeof feeds!=='object'||Array.isArray(feeds))throw Error('FUSION_FEEDS_INVALID');
 const keys=['suhail','listings','earth','national'],out=[],errors=[];
 let total=0;
 for(const key of keys){
  const rows=feeds[key]??[];
  if(!Array.isArray(rows)||rows.length>MAX_ROWS)throw Error('FUSION_FEED_CAP_INVALID_'+key);
  total+=rows.length;
  if(total>MAX_ROWS)throw Error('FUSION_TOTAL_CAP_EXCEEDED');
  for(let i=0;i<rows.length;i++){
   const r=rows[i];
   if(!r||typeof r!=='object'||Array.isArray(r)||r.country!=='SA'||
      r.marketValuationEligible!==false||r.executedTransactionRecord!==false||
      !short(r.city)||!short(r.district)||!dated(r.observedOn)){
    errors.push({feed:key,row:i+1,code:'INVALID_OR_PRIVILEGE_ESCALATED_RECORD'});continue;
   }
   let type,ref,origin,surface,price=null,area=null,transactionId=null,
       eventDate=null,assetType=null,planNumber=null,parcelNumber=null;
   if(key==='suhail'){
    if(!['NEIGHBORHOOD_AGGREGATE_INDEXED_UNVERIFIED',
       'USER_IMPORTED_NEIGHBORHOOD_AGGREGATE_UNVERIFIED'].includes(r.recordClass)||
      !sourceUrl(r.sourceUrl)||!(new URL(r.sourceUrl).hostname==='suhail.ai'||
       new URL(r.sourceUrl).hostname.endsWith('.suhail.ai'))) {
      errors.push({feed:key,row:i+1,code:'SOURCE_INVALID'});continue;}
    type='NEIGHBORHOOD_AGGREGATE';ref=r.city+'/'+r.district+'/'+r.observedOn;
    origin='SUHAIL';surface=r.sourceUrl;
   }else if(key==='listings'){
    if(!SOURCE_MAP[r.sourceId]?.capabilities.includes(r.kind)||!sourceUrl(r.listingUrl)||
      !SOURCE_MAP[r.sourceId].domains.some(d=>new URL(r.listingUrl).hostname===d||
       new URL(r.listingUrl).hostname.endsWith('.'+d))){
     errors.push({feed:key,row:i+1,code:'SOURCE_INVALID'});continue;
    }
    type=r.kind;ref=r.listingId||r.listingUrl;origin=r.sourceId;surface=r.listingUrl;
    price=finite(r.askingPriceOrBudgetSar);area=finite(r.areaSqm);
    assetType=short(r.assetType);eventDate=r.listingDate||null;
   }else if(key==='earth'){
    if(!BY_FEATURE[r.sourceFeatureId]||r.sourceUrl!==BY_FEATURE[r.sourceFeatureId].url||
      r.source!=='EARTH_APP'){errors.push({feed:key,row:i+1,code:'SOURCE_INVALID'});continue;}
    type=r.evidenceKind;ref=r.recordId||r.sourceFeatureId+'/'+r.city+'/'+r.district;
    origin='EARTH_'+r.sourceFeatureId;surface=r.sourceUrl;
    price=finite(r.amountSar);area=finite(r.areaSqm);eventDate=r.eventDate||null;
    transactionId=r.evidenceKind==='REPORTED_SALE'?r.recordId:null;
    assetType=short(r.assetType);planNumber=short(r.planNumber);parcelNumber=short(r.parcelNumber);
   }else{
    if(!BY_ID[r.sourceId]?.allowed.includes(r.evidenceClass)||
      !sourceUrl(r.sourceUrl)||new URL(r.sourceUrl).hostname!==
        new URL(BY_ID[r.sourceId].url).hostname){
      errors.push({feed:key,row:i+1,code:'SOURCE_INVALID'});continue;
    }
    type=r.evidenceClass;
    ref=r.recordId||[r.metricName||r.sourceId,
      r.periodStart||'',r.periodEnd||'',r.assetType||''].join(':');
    origin=r.sourceId;surface=r.sourceUrl;price=finite(r.metricValue);
    eventDate=r.eventDate||null;transactionId=type==='OFFICIAL_REPORTED_SALE'||
       type==='THIRD_PARTY_REPORTED_SALE'?r.recordId:null;
    assetType=short(r.assetType);
   }
   if(eventDate!==null&&(!dated(eventDate)||eventDate>r.observedOn)){
    errors.push({feed:key,row:i+1,code:'DATE_CONFLICT'});continue;
   }
   const proposed={origin,type,ref:short(ref),city:short(r.city),district:short(r.district),
    observedOn:r.observedOn,eventDate,transactionId:short(transactionId),
    assetType,planNumber,parcelNumber,priceOrMetricSar:price,areaSqm:area};
   const evidenceId=researchEvidenceId(key,proposed);
   out.push(Object.freeze({evidenceId,feed:key,origin,type,city:short(r.city),
    district:short(r.district),assetType,observedOn:r.observedOn,
    eventDate,ref:short(ref),sourceUrl:surface,priceOrMetricSar:price,
    areaSqm:area,transactionId:short(transactionId),
    planNumber,parcelNumber,sourceAuthenticated:false,officialTitleVerified:false,
    executedTransactionConfirmed:false,professionalComparableSelected:false,
    eligibleForFinancialCalculation:false}));
  }
 }
 return {records:out,errors,inputRows:total};
}
const equalsLocation=(a,b)=>norm(a.city)===norm(b.city)&&norm(a.district)===norm(b.district);
function compareCandidates(records){
 const duplicates=[],conflicts=[],identity=new Map(),crossSources=[],areas=new Map();
 for(const record of records){
  // Within one provider, duplicated references on the same observation date
  // cannot count as independent market evidence.
  const identityKey=[record.origin,record.type,norm(record.ref),norm(record.city),
    norm(record.district),record.observedOn].join('|');
  const first=identity.get(identityKey);
  if(first){
   if(first.priceOrMetricSar!==record.priceOrMetricSar||
      first.areaSqm!==record.areaSqm||first.assetType!==record.assetType||
      first.planNumber!==record.planNumber||first.parcelNumber!==record.parcelNumber||
      first.eventDate!==record.eventDate||!equalsLocation(first,record))
    conflicts.push({ids:[first.evidenceId,record.evidenceId],reason:'CONFLICTING_SOURCE_REFERENCE'});
   else duplicates.push({ids:[first.evidenceId,record.evidenceId],reason:'REPEATED_SOURCE_REFERENCE'});
  }else identity.set(identityKey,record);
  // Cross-provider exact transaction fingerprint remains *potential*:
  // same price, day, area and district is not conclusive identity.
  if(['REPORTED_SALE','OFFICIAL_REPORTED_SALE','THIRD_PARTY_REPORTED_SALE'].includes(record.type)
     &&record.priceOrMetricSar>0&&record.eventDate&&
       (record.transactionId||record.areaSqm>0)){
   // Prefer transaction ID if present; otherwise require the same price AND area.
   // This only flags a possible repeat. Unverified IDs may collide across providers.
   const locator=record.transactionId?'id:'+norm(record.transactionId):
     'area:'+record.areaSqm;
   const k=[norm(record.city),norm(record.district),record.eventDate,
      record.priceOrMetricSar,locator].join('|');
   const matches=areas.get('sale:'+k)||[];
   for(const p of matches)if(p.origin!==record.origin)
    crossSources.push({ids:[p.evidenceId,record.evidenceId],reason:'POTENTIAL_REPEATED_REPORTED_SALE'});
   matches.push(record);areas.set('sale:'+k,matches);
  }
  if(record.type==='SALE_OFFER'&&record.priceOrMetricSar>0&&record.areaSqm>0&&record.assetType){
   const k=[norm(record.city),norm(record.district),norm(record.assetType),
      record.priceOrMetricSar,record.areaSqm].join('|');
   const matches=areas.get('offer:'+k)||[];
   for(const p of matches)if(p.origin!==record.origin)
    crossSources.push({ids:[p.evidenceId,record.evidenceId],reason:'POTENTIAL_CROSS_PORTAL_SAME_OFFER'});
   matches.push(record);areas.set('offer:'+k,matches);
  }
 }
 return {duplicates,conflicts,crossSources};
}
function buildUnifiedResearch({subject={},feeds={},asOf='2026-10-28'}={}){
 if(!dated(asOf))throw Error('FUSION_ASOF_INVALID');
 const {records,errors,inputRows}=fromResearchFeeds(feeds);
 const city=norm(subject.city),district=norm(subject.district);
 const related=records.filter(x=>city&&district&&norm(x.city)===city&&norm(x.district)===district&&
  x.observedOn<=asOf);
 const identified=related.filter(x=>x.planNumber&&x.parcelNumber&&
  subject.planNumber&&subject.parcelNumber&&norm(subject.planNumber)===norm(x.planNumber)&&
  norm(subject.parcelNumber)===norm(x.parcelNumber));
 const links=compareCandidates(related);
 const kinds={};for(const x of related)kinds[x.type]=(kinds[x.type]||0)+1;
 const risks=['RESEARCH_ONLY_NOT_INDEPENDENTLY_VERIFIED'];
 if(!city||!district)risks.push('SUBJECT_CITY_AND_DISTRICT_REQUIRED');
 if(!identified.length)risks.push('SUBJECT_PARCEL_IDENTITY_NOT_ESTABLISHED');
 if(!related.length)risks.push('NO_RELEVANT_RESEARCH_RECORDS');
 if(links.crossSources.length)risks.push('POTENTIAL_CROSS_SOURCE_DUPLICATES_REVIEW');
 if(links.conflicts.length)risks.push('CONFLICTING_RECORDS_REVIEW');
 if(errors.length)risks.push('INVALID_RESEARCH_ROWS_REJECTED');
 if(records.some(x=>x.observedOn>asOf))risks.push('POST_ASOF_RESEARCH_EXCLUDED');
 return {
  version:VERSION,asOf,subject:{assetType:short(subject.assetType),
   city:short(subject.city),district:short(subject.district)},
  status:'HOLD_UNVERIFIED_PERSONAL_RESEARCH',
  totalInputRows:inputRows,validResearchRows:records.length,
  feedReadiness:['suhail','listings','earth','national'].map(feed=>{
   const items=records.filter(x=>x.feed===feed);
   return {feed,importedResearchRows:items.length,
    mode:feed==='suhail'?'PUBLIC_INDEX_SAMPLE_OR_MANUAL_CSV':'USER_IMPORTED_CSV_ONLY',
    confirmedLiveApiConnected:false,independentRecordAuthentication:false,
    lastObservedOn:items.length?items.map(x=>x.observedOn).sort().at(-1):null};
  }),
  rejectedRows:errors,subjectAreaRows:related.length,
  countsByType:kinds,areaScopeOnly:related.filter(x=>!identified.includes(x)).length,
  matchedParcelCandidates:identified.length,
  possibleRepeatedObservations:links.duplicates.length,
  possibleCrossSourceDuplicates:links.crossSources,
  contradictoryObservations:links.conflicts,
  sourceRefs:[...new Set(related.map(x=>x.origin))].sort(),
  context:related.slice(0,100),
  risks:[...new Set(risks)],
  verifiedExecutedSales:0,authenticatedPropertyRights:false,
  certifiedMarketValueSar:null,approvedOfferPriceSar:null,
  investorMaximumPurchaseSar:null,modelAccuracyPct:null,
  professionalReportAuthorized:false,goForInvestment:false,
  dataRightsIndependentlyVerified:false,
  qualitativeStatement:'Data gathered from local research imports and public indexed context only. Requires independent source/title authentication, time-matched comparables and professional review before economic recommendations.'
 };
}
function researchClaimsGate({snapshot,claims=[]}={}){
 if(!snapshot||snapshot.version!==VERSION||!Array.isArray(snapshot.context)||
   snapshot.status!=='HOLD_UNVERIFIED_PERSONAL_RESEARCH'||
   !Array.isArray(claims)||claims.length>40)
  return {status:'REJECTED',reasons:['CLAIMS_OR_SNAPSHOT_INVALID']};
 const ids=new Set(snapshot.context.map(x=>x.evidenceId));
 const reasons=[];
 const safe=claims.map((c,i)=>{
  if(!c||!['OBSERVATION','LIMITATION','REVIEW_TASK'].includes(c.kind)||
    typeof c.text!=='string'||!c.text.trim()||c.text.length>500||
    !Array.isArray(c.evidenceIds)||c.evidenceIds.length>15) {
   reasons.push('CLAIM_FORMAT_INVALID_'+i);return null;
  }
  if(c.evidenceIds.some(id=>!ids.has(id)))reasons.push('CLAIM_UNSUPPORTED_CITATION_'+i);
  if(c.kind==='OBSERVATION'&&!c.evidenceIds.length)reasons.push('OBSERVATION_EVIDENCE_REQUIRED_'+i);
  if(containsProhibitedDecisionLanguage(c.text)||
     /\b(?:BUY|SELL|APPROVED|CERTIFIED|TRADE|INVEST NOW|GUARANTEED)\b/i.test(c.text)||
     /(?:اشتر|اشتري|نوصي بالشراء|أوصي بالشراء|اوصي بالشراء|أنصح بالشراء|انصح بالشراء|الشراء معتمد|القيمة معتمدة|تقييم معتمد|الصفقة مؤكدة|توصية نهائية|شراء مؤكد|بيع مضمون)/.test(c.text))
   reasons.push('MODEL_CANNOT_AUTHORIZE_ACTION_'+i);
  if(/[0-9٠-٩۰-۹]|[%٪$€]|\b(?:SAR|USD|million|billion)\b|(?:مليون|مليار|ألف ريال|ريال سعودي)/i.test(c.text))
   reasons.push('UNVERIFIED_NUMERIC_CLAIM_NOT_ALLOWED_'+i);
  if(/https?:\/\/|(?:<script|ignore previous|تجاهل التعليمات)/i.test(c.text))
   reasons.push('RESEARCH_TEXT_HAS_UNTRUSTED_INSTRUCTIONS_OR_LINKS_'+i);
  return {kind:c.kind,text:c.text,evidenceIds:c.evidenceIds.slice()};
 }).filter(Boolean);
 return {status:reasons.length?'REJECTED':'RESEARCH_TEXT_ONLY',reasons,
  acceptedClaims:reasons.length?[]:safe,certified:false,
  numericOutputsAllowed:false,professionalReportAuthorized:false};
}
function publicOpenDataAnnex({snapshot,neighborhood=null,loadMeta=null}={}){
 if(!snapshot||snapshot.version!==VERSION)throw Error('OPEN_DATA_ANNEX_INVALID_SNAPSHOT');
 const base={kind:'MOJ_HISTORIC_PUBLIC_OPEN_DATA_RESEARCH',
  status:'NOT_LOADED',city:snapshot.subject.city,district:snapshot.subject.district,
  asOf:snapshot.asOf,transactionCount:0,medianNeighborhoodSarSqm:null,
  sampleDateMin:null,sampleDateMax:null,quarters:[],partialCoverage:null,
  independentPropertyTransactionVerified:false,parcelSuitabilityVerified:false,
  professionalComparableEligible:false,sourceAuthenticationPerformed:false,
  dataOrigin:'Saudi Ministry of Justice open data via public GitHub mirror',
  limitations:['HISTORICAL_AGGREGATE_NOT_LIVE','SUBTYPE_AND_PARCEL_NOT_VERIFIED']};
 if(!loadMeta)return base;
 if(!neighborhood||!['HISTORIC_NEIGHBORHOOD_CONTEXT','INSUFFICIENT_TRANSACTIONS','LOCATION_REQUIRED'].includes(neighborhood.status))
  return {...base,status:'INVALID_OR_UNAVAILABLE_NEIGHBORHOOD'};
 if(norm(neighborhood.city)!==norm(snapshot.subject.city)||
    norm(neighborhood.district)!==norm(snapshot.subject.district))
  return {...base,status:'LOCATION_MISMATCH'};
 const max=neighborhood.maxDate,min=neighborhood.minDate;
 if(max&&(!dated(max)||max>snapshot.asOf)||min&&(!dated(min)||min>snapshot.asOf))
  return {...base,status:'POST_ASOF_DATA_REJECTED'};
 const safeCount=Number.isInteger(neighborhood.count)&&neighborhood.count>=0?
  neighborhood.count:0;
 const enough=safeCount>=3&&neighborhood.status==='HISTORIC_NEIGHBORHOOD_CONTEXT';
 const median=enough&&typeof neighborhood.medianPriceSqm==='number'&&
  Number.isFinite(neighborhood.medianPriceSqm)&&neighborhood.medianPriceSqm>0&&
  neighborhood.medianPriceSqm<=2e6?neighborhood.medianPriceSqm:null;
 return {...base,status:median===null?'INSUFFICIENT_HISTORIC_CONTEXT':
  'HISTORIC_NEIGHBORHOOD_AGGREGATE_RESEARCH_ONLY',
  transactionCount:safeCount,medianNeighborhoodSarSqm:median,
  sampleDateMin:min||null,sampleDateMax:max||null,
  quarters:Array.isArray(loadMeta.sources)?loadMeta.sources.map(x=>String(x.quarter||'')).filter(x=>/^\d{4}-Q[1-4]$/.test(x)).slice(0,12):[],
  partialCoverage:loadMeta.incomplete===true,
  limitations:[...base.limitations,...(loadMeta.incomplete===true?['SOME_QUARTERS_UNAVAILABLE']:[])]};
}

function scenarioAnnex({marketReport=null,readiness=null}={}){
 const fields=['saleIndicationSar','incomeIndicationSar','todayValueScenarioSar',
  'marketAnnualRentPotentialSar','expectedCollectedAnnualRentSar','estimatedAnnualNoiSar',
  'methodGapPct','confidence'];
 const nonNegative=(name,v)=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=1e15?v:null;
 const values=Object.fromEntries(fields.map(k=>[k,
  k==='confidence'?String(marketReport?.[k]??'').slice(0,60)||null:
  nonNegative(k,marketReport?.[k])]));
 const problems=Array.isArray(marketReport?.issues)?
  marketReport.issues.filter(x=>typeof x==='string').slice(0,35):[];
 const reasons=Array.isArray(readiness?.reasons)?
  readiness.reasons.filter(x=>typeof x==='string').slice(0,35):[];
 return {type:'USER_INPUT_DETERMINISTIC_SCENARIO_ONLY',
  fromExistingMarketCalculator:true,sourceAuthenticationPerformed:false,
  useForCertifiedAppraisal:false,investorPurchaseAuthorized:false,
  previewValuesSar:values,marketCalculatorIssues:problems,
  currentReadinessStatus:String(readiness?.status||'NOT_EVALUATED').slice(0,80),
  currentReadinessReasons:reasons,
  disclaimer:'These deterministic outputs are conditional user-input scenarios, not independently verified market values or licensed appraisals.'};
}

function researchReportBundle(snapshot,{marketReadinessStatus='NOT_TESTED',marketReport=null,readiness=null,publicNeighborhood=null,publicLoadMeta=null}={}){
 if(!snapshot||snapshot.version!==VERSION)throw Error('FUSION_REPORT_INVALID');
 return {kind:'STARTAK_RESEARCH_EVIDENCE_BRIEF_V1',version:VERSION,
  researchAsOf:snapshot.asOf,subject:snapshot.subject,
  researchStatus:snapshot.status,marketReadinessStatus:short(marketReadinessStatus),
  studySummary:{inputRows:snapshot.totalInputRows,validRows:snapshot.validResearchRows,
   rejectedRows:snapshot.rejectedRows.length,areaRows:snapshot.subjectAreaRows,
   sourceRefs:snapshot.sourceRefs,countsByType:snapshot.countsByType,
   feedReadiness:snapshot.feedReadiness,
   duplicates:snapshot.possibleRepeatedObservations,
   possibleCrossSourceDuplicates:snapshot.possibleCrossSourceDuplicates.length,
   conflictingRecords:snapshot.contradictoryObservations.length},
  evidenceIndex:snapshot.context.map(x=>({id:x.evidenceId,origin:x.origin,type:x.type,
    city:x.city,district:x.district,date:x.eventDate||x.observedOn,
    url:x.sourceUrl,verified:false})),
  scenarioAnnex:scenarioAnnex({marketReport,readiness}),
  openDataAnnex:publicOpenDataAnnex({snapshot,neighborhood:publicNeighborhood,loadMeta:publicLoadMeta}),
  riskCodes:snapshot.risks,valuationSar:null,maximumPurchaseSar:null,
  investmentDecision:'HOLD_REQUIRES_INDEPENDENT_MARKET_AND_FINANCIAL_EVIDENCE',
  permittedUse:'PERSONAL_RESEARCH_DRAFT',publishableProfessionalValuation:false,
  aiUse:'Evidence summaries and hypotheses only; deterministic math and authority gates remain separate',
  explicitlyNotVerified:['CURRENT_MARKET_TRANSACTIONS','TITLE_RIGHTS','AI_MODEL_ACCURACY',
   'LIVE_SOURCE_APIS','PROPERTY_LEVEL_COMPARABLES','PROFESSIONAL_APPRAISAL']};
}
module.exports={VERSION,fromResearchFeeds,compareCandidates,buildUnifiedResearch,
 researchClaimsGate,researchReportBundle,scenarioAnnex,publicOpenDataAnnex};
