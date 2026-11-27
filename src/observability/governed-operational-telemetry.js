'use strict';
// Recovered C27 contract: local diagnostic only. No provider export.
// Free-form payload is deliberately dropped rather than attempting to detect
// every possible sensitive value. Opaque refs must be supplied by trusted code.
const crypto=require('node:crypto');
const {isPlainJson}=require('../validation/plain-json-boundary');
const {strictCalendarDateMs}=require('../validation/strict-calendar-instant');
const enumOf=a=>Object.freeze(Object.fromEntries(a.map(x=>[x,x])));
const EVENT_TYPE=enumOf(['CASE_EVALUATED','SOURCE_STATE','AI_GATEWAY','RBAC_ACTION','REPLAY_CONFLICT','KILL_SWITCH','SYSTEM_HEALTH']);
const SEVERITY=enumOf(['INFO','WARN','ERROR','CRITICAL']);
const TECHNICAL_HEALTH=enumOf(['HEALTHY','DEGRADED','UNAVAILABLE','UNKNOWN']);
const METRIC=Object.freeze({SOURCE_STALE_COUNT:'source_stale_count',SOURCE_OUTAGE_COUNT:'source_outage_count',AI_BLOCKED_OUTPUT_COUNT:'ai_blocked_output_count',RBAC_DENIAL_COUNT:'rbac_denial_count',REPLAY_CONFLICT_COUNT:'replay_conflict_count',KILL_SWITCH_ENGAGED:'kill_switch_engaged'});
const ERROR_CLASS=enumOf(['INTEGRITY','AUTHORIZATION','TEMPORAL','SOURCE','AI_GROUNDING','REPLAY','SCHEMA','DEPENDENCY','INTERNAL']);
const BUSINESS_STATES=new Set(['HOLD','READY','HOLD_EVIDENCE','HOLD_RECONCILIATION','UNKNOWN']);
const COMPONENTS=new Set(['SOURCE','AI','RBAC','REPLAY','CASE','SYSTEM','STORAGE','REPORT','API']);
const SAFE_FLAGS=['blocked','stale','outage','conflict','killSwitchEngaged'];
const SAFE_COUNTS=['count','durationMs'];
const REF=/^[A-Za-z0-9_.:-]{2,128}$/,SHA=/^[a-f0-9]{64}$/;
const ref=x=>{if(typeof x!=='string'||!REF.test(x))throw Error('C27_REFERENCE_INVALID');return x;};
const optRef=x=>x==null?null:ref(x);
const iso=x=>{const ms=strictCalendarDateMs(x);if(!Number.isFinite(ms))throw Error('C27_DATE_INVALID');return new Date(ms).toISOString();};
const member=(x,e)=>{if(!Object.values(e).includes(x))throw Error('C27_ENUM_INVALID');return x;};
const stable=x=>Array.isArray(x)?x.map(stable):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,stable(x[k])])):x;
const hash=x=>crypto.createHash('sha256').update(JSON.stringify(stable(x))).digest('hex');
const same=(a,b)=>hash(a)===hash(b);
const authority=()=>({transactionAuthorized:false,approvalAuthorized:false,publicAiAuthorized:false,productionDeploymentAuthorized:false,commercialGoLive:'HOLD',canonicalBaselineActivationAuthorized:false,autonomousActionExecuted:false});
function plain(x){if(!isPlainJson(x)||!x||Array.isArray(x)||typeof x!=='object')throw Error('C27_INPUT_JSON_INVALID');}
function rejectAuthority(x){for(const [k,v] of Object.entries(authority()))if(Object.hasOwn(x,k)&&x[k]!==v)throw Error('C27_AUTHORITY_INJECTION_FORBIDDEN');}
function scope(x){const caseId=optRef(x.caseId),propertyRef=optRef(x.propertyRef);if((caseId===null)!==(propertyRef===null))throw Error('C27_CASE_PROPERTY_SCOPE_INCOMPLETE');return {caseId,propertyRef};}
function redactSensitive(payload={}){
 plain(payload);const out={};
 for(const k of SAFE_FLAGS)if(typeof payload[k]==='boolean')out[k]=payload[k];
 for(const k of SAFE_COUNTS)if(Number.isSafeInteger(payload[k])&&payload[k]>=0&&payload[k]<=1e9)out[k]=payload[k];
 return Object.freeze(out);
}
function createTelemetryEvent(x){
 plain(x);rejectAuthority(x);
 const m={eventId:ref(x.eventId),eventType:member(x.eventType,EVENT_TYPE),severity:member(x.severity,SEVERITY),occurredAt:iso(x.occurredAt),correlationRef:ref(x.correlationRef),...scope(x),requestRef:optRef(x.requestRef),sessionRef:optRef(x.sessionRef),sourceComponent:COMPONENTS.has(x.sourceComponent)?x.sourceComponent:'SYSTEM',technicalHealth:member(x.technicalHealth,TECHNICAL_HEALTH),businessReadiness:BUSINESS_STATES.has(x.businessReadiness)?x.businessReadiness:null,errorClass:x.errorClass==null?null:member(x.errorClass,ERROR_CLASS),payload:redactSensitive(x.payload??{}),...authority()};
 return Object.freeze({...m,eventHashSha256:hash(m)});
}
function verifyTelemetryEvent(x){try{plain(x);return same(x,createTelemetryEvent(x))?{valid:true,reason:null}:{valid:false,reason:'C27_EVENT_INTEGRITY_MISMATCH'};}catch{return {valid:false,reason:'C27_EVENT_INTEGRITY_MISMATCH'};}}
function createMetricObservation(x){
 plain(x);const metric=member(x.metric,METRIC),value=x.value;
 if(metric===METRIC.KILL_SWITCH_ENGAGED?typeof value!=='boolean':!Number.isSafeInteger(value)||value<0)throw Error('C27_METRIC_VALUE_INVALID');
 if(typeof x.evidenceHashSha256!=='string'||!SHA.test(x.evidenceHashSha256))throw Error('C27_METRIC_EVIDENCE_HASH_INVALID');
 const m={metricId:ref(x.metricId),metric,value,observedAt:iso(x.observedAt),correlationRef:ref(x.correlationRef),evidenceRef:ref(x.evidenceRef),evidenceHashSha256:x.evidenceHashSha256,...scope(x)};
 return Object.freeze({...m,metricHashSha256:hash(m)});
}
function summarizeOperationalState(x){
 const hold=reason=>Object.freeze({status:'HOLD_TELEMETRY',technicalHealth:TECHNICAL_HEALTH.UNKNOWN,telemetryIntegrityReady:false,technicalServiceHealthy:false,businessApprovalInferred:false,liveMonitoringVerified:false,productionMonitoringVerified:false,blockers:Object.freeze([reason]),...authority()});
 try{
  plain(x);const asOf=iso(x.asOf),at=strictCalendarDateMs(asOf),s=scope(x);
  if(at>Date.now()||!Array.isArray(x.events)||!Array.isArray(x.metrics)||!x.events.length||x.events.length>1000||x.metrics.length>1000)return hold('C27_COLLECTION_OR_WINDOW_INVALID');
  const events=[],metrics=[],ids=new Set();
  const bound=(y,t,id)=>{if(y.caseId!==s.caseId||y.propertyRef!==s.propertyRef||strictCalendarDateMs(t)>at||ids.has(id))throw Error('C27_SCOPE_TIME_OR_DUPLICATE');ids.add(id);};
  for(const event of x.events){if(!verifyTelemetryEvent(event).valid)return hold('C27_EVENT_INTEGRITY_MISMATCH');bound(event,event.occurredAt,event.eventId);events.push(event);}
  for(const metric of x.metrics){if(!same(metric,createMetricObservation(metric)))return hold('C27_METRIC_INTEGRITY_MISMATCH');bound(metric,metric.observedAt,metric.metricId);metrics.push(metric);}
  const rank=['HEALTHY','UNKNOWN','DEGRADED','UNAVAILABLE'];
  const killSwitchEngaged=metrics.some(m=>m.metric===METRIC.KILL_SWITCH_ENGAGED&&m.value===true);
  const technicalHealth=rank[Math.max(killSwitchEngaged?2:0,...events.map(e=>rank.indexOf(e.technicalHealth)))];
  const material={asOf,...s,technicalHealth,killSwitchEngaged,businessReadinessObserved:Object.freeze([...new Set(events.map(e=>e.businessReadiness).filter(Boolean))].sort()),eventHashesSha256:Object.freeze(events.map(e=>e.eventHashSha256).sort()),metricHashesSha256:Object.freeze(metrics.map(m=>m.metricHashSha256).sort())};
  return Object.freeze({...material,status:'STRUCTURAL_TELEMETRY_REVIEW',summaryHashSha256:hash(material),telemetryIntegrityReady:true,technicalServiceHealthy:false,businessApprovalInferred:false,liveMonitoringVerified:false,productionMonitoringVerified:false,blockers:Object.freeze([]),...authority()});
 }catch{return hold('C27_TELEMETRY_VALIDATION_FAILED');}
}
module.exports={EVENT_TYPE,SEVERITY,TECHNICAL_HEALTH,METRIC,ERROR_CLASS,redactSensitive,createTelemetryEvent,verifyTelemetryEvent,createMetricObservation,summarizeOperationalState};
