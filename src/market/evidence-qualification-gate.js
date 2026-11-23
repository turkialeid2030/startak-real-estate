'use strict';
// Deterministic intake triage. This module is not a reviewer, data licence,
// title authority, transaction certifier or market valuation methodology.
// It never upgrades imported source claims into verified comparable evidence.
const {BY_ID}=require('./saudi-national-intelligence-sources');
const {BY_ID:MANUAL_SOURCES}=require('./no-api-source-bridge');

const VERSION='STARTAK_RE_EVIDENCE_QUALIFICATION_GATE_V1';
// Only results created by this module can become exportable review dossiers.
// An imported/forged object with a matching version and HOLD marker is not proof.
const ISSUED_RESULTS=new WeakSet();
const MAX_ROWS=1500, MAX_REFERENCES=100, MAX_DOSSIER_BYTES=256*1024;
// An adversarial batch can repeat one transaction across 1500 records and
// produce hundreds of thousands of cross-provider pairings. Preserve exact
// counts but retain only bounded review examples; never materialize all pairs.
const MAX_CROSS_PROVIDER_PAIR_SAMPLES=1024;
const BUCKET=Object.freeze({
 OFFICIAL_AGGREGATE:'AGGREGATE_CONTEXT',
 THIRD_PARTY_AGGREGATE:'AGGREGATE_CONTEXT',
 OFFICIAL_REPORTED_SALE:'REPORTED_SALE_CANDIDATE',
 THIRD_PARTY_REPORTED_SALE:'REPORTED_SALE_CANDIDATE',
 EXTERNAL_AVM_ESTIMATE:'EXTERNAL_MODEL_BENCHMARK',
 RESEARCH_NOTE:'RESEARCH_NOTE_ONLY',
});
const EXPECTED_METRIC=Object.freeze({
 OFFICIAL_REPORTED_SALE:'sale_price_sar',
 THIRD_PARTY_REPORTED_SALE:'sale_price_sar',
 EXTERNAL_AVM_ESTIMATE:'estimated_value_sar',
});
const norm=s=>String(s??'').trim().replace(/[أإآٱ]/g,'ا').replace(/ة/g,'ه')
 .replace(/ى/g,'ي').replace(/\s+/g,' ').toLowerCase();
const own=(x,k)=>Object.prototype.hasOwnProperty.call(x,k);
const isoDate=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&
 Number.isFinite(Date.parse(v+'T00:00:00Z'))&&
 new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v;
const codeOnly=v=>typeof v==='string'&&v.length<=130&&
 !/[\u0000-\u001f\u007f<>]/.test(v);
const uniq=a=>[...new Set(a)];
const parseAsOf=asOf=>{
 const date=asOf instanceof Date?asOf.toISOString().slice(0,10):asOf;
 if(!isoDate(date))throw Error('QUALIFICATION_AS_OF_INVALID');
 return date;
};
function secureSourceUrl(value,source){
 if(typeof value!=='string'||value.length>2000)return false;
 try{
  const url=new URL(value);
  const hostname=url.hostname.toLowerCase(),domain=source.domain.toLowerCase();
  const declaredHost=new URL(source.url).hostname.toLowerCase();
  // A provider may officially publish from a fixed subdomain, e.g. the
  // registered ai.grem.capital service. Trust only the explicitly registered
  // origin, not every arbitrary subdomain matching a suffix.
  return url.protocol==='https:'&&!url.username&&!url.password&&!url.port&&
   (hostname===declaredHost||hostname===domain||hostname==='www.'+domain);
 }catch{return false;}
}
function inspectRecord(record,i,{subject,asOf}){
 const reasons=[],warnings=[];
 if(!record||typeof record!=='object'||Array.isArray(record)){
  return Object.freeze({index:i,sourceId:null,bucket:'INVALID',status:'REJECTED',
   reasons:Object.freeze(['RECORD_OBJECT_REQUIRED']),warnings:Object.freeze([]),
   marketValuationEligible:false});
 }
 const source=own(BY_ID,record.sourceId)?BY_ID[record.sourceId]:null;
 const bucket=own(BUCKET,record.evidenceClass)?BUCKET[record.evidenceClass]:'INVALID';
 if(!source)reasons.push('UNREGISTERED_SOURCE');
 if(!source?.allowed.includes(record.evidenceClass)||bucket==='INVALID')
  reasons.push('SOURCE_CLASS_SCOPE_INVALID');
 if(!source||!secureSourceUrl(record.sourceUrl,source))
  reasons.push('SOURCE_URL_UNTRUSTED');
 if(record.personalResearch!==true)reasons.push('RESEARCH_PROVENANCE_REQUIRED');
 const claims=['sourceRecordAuthenticated','executedTransactionRecord',
  'independentMarketPriceVerified','marketValuationEligible',
  'professionalReportAuthorized','transactionAuthorized','licenseVerified'];
 if(claims.some(k=>record[k]===true))reasons.push('UNTRUSTED_AUTHORITY_CLAIM');
 if(!codeOnly(record.city)||!record.city||!codeOnly(record.district)||!record.district)
  reasons.push('LOCATION_REQUIRED');
 if(!isoDate(record.observedOn)||record.observedOn>asOf)
  reasons.push('OBSERVATION_DATE_INVALID');
 if(record.eventDate!==null&&record.eventDate!==undefined&&
  (!isoDate(record.eventDate)||record.eventDate>asOf||
   isoDate(record.observedOn)&&record.eventDate>record.observedOn))
  reasons.push('EVENT_DATE_INVALID');
 if(record.periodStart||record.periodEnd){
  if(!isoDate(record.periodStart)||!isoDate(record.periodEnd)||
   record.periodStart>record.periodEnd||record.periodEnd>asOf)
   reasons.push('AGGREGATE_PERIOD_INVALID');
 }
 const number=record.metricValue;
 if(number!==null&&(typeof number!=='number'||!Number.isFinite(number)||
   number<0||number>1e15))reasons.push('METRIC_OUT_OF_RANGE');
 if(bucket==='REPORTED_SALE_CANDIDATE'){
  if(!codeOnly(record.recordId)||!record.recordId||!isoDate(record.eventDate))
   reasons.push('TRANSACTION_ID_DATE_REQUIRED');
  if(record.metricName!==EXPECTED_METRIC[record.evidenceClass]||
   record.metricUnit!=='SAR'||!(number>0))
   reasons.push('SALE_PRICE_UNIT_INVALID');
  reasons.push('TRANSACTION_ORIGIN_NOT_AUTHENTICATED',
   'AREA_BASIS_AND_INTEREST_NOT_VERIFIED');
 }else if(bucket==='EXTERNAL_MODEL_BENCHMARK'){
  if(record.metricName!=='estimated_value_sar'||record.metricUnit!=='SAR'||
   !(number>0))reasons.push('AVM_AMOUNT_UNIT_INVALID');
  warnings.push('AVM_IS_NOT_AN_EXECUTED_TRANSACTION');
 }else if(bucket==='AGGREGATE_CONTEXT'){
  if(!isoDate(record.periodStart)||!isoDate(record.periodEnd))
   reasons.push('AGGREGATE_PERIOD_REQUIRED');
  warnings.push('AREA_STATISTIC_NOT_PROPERTY_COMPARABLE');
 }else if(bucket==='RESEARCH_NOTE_ONLY'){
  if(number!==null||record.metricName||record.metricUnit)
   reasons.push('NOTE_WITH_NUMERIC_CLAIM');
 }else reasons.push('INVALID_RESEARCH_CATEGORY');
 if(subject&&typeof subject==='object'){
  if(norm(subject.city)&&norm(record.city)!==norm(subject.city))
   warnings.push('SUBJECT_CITY_MISMATCH');
  if(norm(subject.district)&&norm(record.district)!==norm(subject.district))
   warnings.push('SUBJECT_DISTRICT_MISMATCH');
  if(norm(subject.assetType)&&norm(record.assetType)!==norm(subject.assetType))
   warnings.push('SUBJECT_ASSET_TYPE_MISMATCH');
 }
 // Origin license cannot be inferred from the link, source category, a user
 // acknowledgement, or any "approved" flag in an imported CSV.
 reasons.push('DATASET_LICENSE_AND_RIGHTS_NOT_INDEPENDENTLY_VERIFIED');
 reasons.push('INDEPENDENT_REVIEW_AND_SOURCE_EVIDENCE_REQUIRED');
 const safeReference=codeOnly(record.recordId)?record.recordId.slice(0,80):'';
 return Object.freeze({
  index:i,sourceId:source?.id||null,evidenceClass:record.evidenceClass||null,
  bucket,status:reasons.some(r=>[
    'UNREGISTERED_SOURCE','SOURCE_CLASS_SCOPE_INVALID','SOURCE_URL_UNTRUSTED',
    'UNTRUSTED_AUTHORITY_CLAIM','RECORD_OBJECT_REQUIRED','RESEARCH_PROVENANCE_REQUIRED',
    'LOCATION_REQUIRED','OBSERVATION_DATE_INVALID','EVENT_DATE_INVALID',
    'AGGREGATE_PERIOD_INVALID','METRIC_OUT_OF_RANGE',
    'TRANSACTION_ID_DATE_REQUIRED','SALE_PRICE_UNIT_INVALID',
    'AVM_AMOUNT_UNIT_INVALID','AGGREGATE_PERIOD_REQUIRED',
    'NOTE_WITH_NUMERIC_CLAIM','INVALID_RESEARCH_CATEGORY',
   ].includes(r))?'REJECTED':'HOLD_REVIEW',
  referenceId:safeReference||null,city:codeOnly(record.city)?record.city:null,
  district:codeOnly(record.district)?record.district:null,
  observedOn:isoDate(record.observedOn)?record.observedOn:null,
  reasons:Object.freeze(uniq(reasons)),warnings:Object.freeze(uniq(warnings)),
  marketValuationEligible:false,professionalReportAuthorized:false,
  transactionAuthenticated:false});
}
function qualifiedResearchIntake({records=[],references=[],subject={},asOf=new Date()}={}){
 const today=parseAsOf(asOf);
 if(!Array.isArray(records)||records.length>MAX_ROWS)throw Error('QUALIFICATION_RECORD_LIMIT');
 if(!Array.isArray(references)||references.length>MAX_REFERENCES)
  throw Error('QUALIFICATION_REFERENCE_LIMIT');
 if(!subject||typeof subject!=='object'||Array.isArray(subject))
  throw Error('QUALIFICATION_SUBJECT_INVALID');
 const findings=records.map((r,i)=>inspectRecord(r,i,{subject,asOf:today}));
 const referenceFindings=references.map((r,i)=>{
  const source=own(MANUAL_SOURCES,r?.sourceId)?MANUAL_SOURCES[r.sourceId]:null;
  const reasons=['REFERENCE_ONLY_NOT_A_TRANSACTION',
   'DATASET_LICENSE_AND_RIGHTS_NOT_INDEPENDENTLY_VERIFIED'];
  if(!r||typeof r!=='object'||Array.isArray(r)||!source||
    r.evidenceClass!=='RESEARCH_REFERENCE_ONLY'||r.sourceAuthenticated!==false||
    r.decisionReady!==false||r.productionConnectorUsed!==false||
    r.licenseVerified!==false||r.propertyIdentityVerified!==false||
    r.professionalReportAuthorized!==false||r.contentCopied!==false||
    r.valuationSar!==null||r.annualRentSar!==null)
   reasons.unshift('INVALID_OR_AUTHORITY_FORGED_MANUAL_REFERENCE');
  return Object.freeze({index:i,sourceId:source?.id||null,
   status:reasons.includes('INVALID_OR_AUTHORITY_FORGED_MANUAL_REFERENCE')?'REJECTED':'HOLD_REVIEW',
   bucket:'MANUAL_REFERENCE',reasons:Object.freeze(reasons),
   marketValuationEligible:false});
 });
 const sourceSeen=new Map(),crossSeen=new Map(),duplicates=[],crossProviderCandidates=[];
 let crossProviderPairCount=0;
 for(const f of findings){
  if(!f.referenceId||!f.sourceId)continue;
  const record=records[f.index];
  // Same provider + reference must be unique even if the provider's CSV
  // later changes amount, date, locale, district or property type.
  const sameKey=f.sourceId+'|'+norm(f.referenceId);
  const previous=sourceSeen.get(sameKey);
  if(previous){
   const before=records[previous.index];
   const same=['metricValue','metricUnit','eventDate','evidenceClass',
    'assetType','city','district'].every(k=>before[k]===record[k]);
   duplicates.push({first:previous.index,second:f.index,
    reason:same?'DUPLICATE_SOURCE_RECORD_ID':'CONFLICTING_SOURCE_RECORD_ID'});
  }else sourceSeen.set(sameKey,f);
  // Across providers a shared printed reference is a *candidate* only when
  // city, district and event date also match. Different IDs are never
  // automatically merged based on a similar amount or nearby location.
  const crossKey=[norm(record.city),norm(record.district),
    norm(record.eventDate||''),norm(f.referenceId)].join('|');
  // Aggregate occurrences by source rather than enumerating the Cartesian
  // product. Total pair count remains exact, while review examples are capped.
  let group=crossSeen.get(crossKey);
  if(!group){
   group={total:0,bySource:new Map(),firstBySource:new Map()};
   crossSeen.set(crossKey,group);
  }
  const sameSourceCount=group.bySource.get(f.sourceId)||0;
  const newCrossPairs=group.total-sameSourceCount;
  crossProviderPairCount+=newCrossPairs;
  if(newCrossPairs>0&&crossProviderCandidates.length<MAX_CROSS_PROVIDER_PAIR_SAMPLES){
   for(const [otherSource,prev] of group.firstBySource){
    if(otherSource===f.sourceId)continue;
    crossProviderCandidates.push({
     first:prev.index,second:f.index,reason:'POSSIBLE_CROSS_PROVIDER_SAME_TRANSACTION'});
    if(crossProviderCandidates.length>=MAX_CROSS_PROVIDER_PAIR_SAMPLES)break;
   }
  }
  group.total++;
  group.bySource.set(f.sourceId,sameSourceCount+1);
  if(!group.firstBySource.has(f.sourceId))group.firstBySource.set(f.sourceId,f);
 }
 const totals=Object.freeze({
  importedRows:records.length,manualReferences:references.length,
  reportedSaleCandidates:findings.filter(f=>f.bucket==='REPORTED_SALE_CANDIDATE').length,
  aggregates:findings.filter(f=>f.bucket==='AGGREGATE_CONTEXT').length,
  externalAvms:findings.filter(f=>f.bucket==='EXTERNAL_MODEL_BENCHMARK').length,
  rejected:findings.filter(f=>f.status==='REJECTED').length+
   referenceFindings.filter(f=>f.status==='REJECTED').length,
  duplicatePairs:duplicates.length,
  crossProviderReviewPairs:crossProviderPairCount,
  crossProviderReviewPairsSampled:crossProviderCandidates.length,
  crossProviderPairsTruncated:crossProviderPairCount>crossProviderCandidates.length,
  independentlyQualifiedComparables:0,professionalValuations:0,
 });
 const outcome=Object.freeze({
  version:VERSION,asOf:today,subjectScope:subject.city&&subject.district?
   'DISTRICT_RESEARCH_CONTEXT_ONLY':'PROPERTY_IDENTITY_UNBOUND',
  decision:'HOLD_EXTERNAL_VERIFICATION_REQUIRED',marketValuationEligible:false,
  certifiedMarketValueSar:null,certifiedMarketRentSar:null,
  professionalReportAuthorized:false,productionDataConnectorEnabled:false,
  totals,findings:Object.freeze(findings),referenceFindings:Object.freeze(referenceFindings),
  // Freeze the nested rows as well as their collection so exported review
  // metadata cannot be tampered with after qualification.
  duplicates:Object.freeze(duplicates.map(item=>Object.freeze(item))),
  crossProviderCandidates:Object.freeze(crossProviderCandidates.map(item=>Object.freeze(item))),
  nextEvidenceRequired:Object.freeze([
   'DATASET_LICENSE_AND_RIGHTS_EVIDENCE','ORIGINAL_TRANSACTION_OR_LEASE_RECORD',
   'PARCEL_TITLE_AND_INTEREST_MATCH','AREA_BASIS_AND_DATE_VALIDATION',
   'INDEPENDENT_VALUER_AND_COMPLIANCE_REVIEW','HOLDOUT_VALIDATION_AND_UAT',
  ]),
 });
 ISSUED_RESULTS.add(outcome);
 return outcome;
}
function portableReviewDossier(result){
 if(!result||!ISSUED_RESULTS.has(result)||result.version!==VERSION||
  result.decision!=='HOLD_EXTERNAL_VERIFICATION_REQUIRED')
  throw Error('QUALIFICATION_DOSSIER_INPUT_INVALID');
 const safe={
  version:VERSION,asOf:result.asOf,decision:result.decision,
  totals:result.totals,sourceReview:result.findings.map(f=>({
   index:f.index,sourceId:f.sourceId,evidenceClass:f.evidenceClass,
   bucket:f.bucket,status:f.status,reasonCodes:f.reasons,warningCodes:f.warnings,
  })),referenceReview:result.referenceFindings.map(f=>({
   index:f.index,sourceId:f.sourceId,status:f.status,reasonCodes:f.reasons,
  })),duplicatePairs:result.duplicates,crossProviderReviewPairs:result.crossProviderCandidates,
  nextEvidenceRequired:result.nextEvidenceRequired,
  certifiedMarketValueSar:null,certifiedMarketRentSar:null,
 };
 const value=JSON.stringify(safe,null,2);
 if(new TextEncoder().encode(value).length>MAX_DOSSIER_BYTES)throw Error('QUALIFICATION_DOSSIER_TOO_LARGE');
 return value;
}
module.exports={VERSION,BUCKET,MAX_ROWS,MAX_REFERENCES,
 MAX_CROSS_PROVIDER_PAIR_SAMPLES,
 qualifiedResearchIntake,portableReviewDossier};
