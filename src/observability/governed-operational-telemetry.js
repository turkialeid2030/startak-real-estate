'use strict';

const crypto = require('crypto');

const EVENT_TYPE = Object.freeze({
  CASE_EVALUATED: 'CASE_EVALUATED',
  SOURCE_STATE: 'SOURCE_STATE',
  AI_GATEWAY: 'AI_GATEWAY',
  RBAC_ACTION: 'RBAC_ACTION',
  REPLAY_CONFLICT: 'REPLAY_CONFLICT',
  KILL_SWITCH: 'KILL_SWITCH',
  SYSTEM_HEALTH: 'SYSTEM_HEALTH',
});

const SEVERITY = Object.freeze({INFO:'INFO', WARN:'WARN', ERROR:'ERROR', CRITICAL:'CRITICAL'});
const TECHNICAL_HEALTH = Object.freeze({HEALTHY:'HEALTHY', DEGRADED:'DEGRADED', UNAVAILABLE:'UNAVAILABLE', UNKNOWN:'UNKNOWN'});
const METRIC = Object.freeze({
  SOURCE_STALE_COUNT: 'source_stale_count',
  SOURCE_OUTAGE_COUNT: 'source_outage_count',
  AI_BLOCKED_OUTPUT_COUNT: 'ai_blocked_output_count',
  RBAC_DENIAL_COUNT: 'rbac_denial_count',
  REPLAY_CONFLICT_COUNT: 'replay_conflict_count',
  KILL_SWITCH_ENGAGED: 'kill_switch_engaged',
});
const ERROR_CLASS = Object.freeze({
  INTEGRITY: 'INTEGRITY', AUTHORIZATION: 'AUTHORIZATION', TEMPORAL: 'TEMPORAL',
  SOURCE: 'SOURCE', AI_GROUNDING: 'AI_GROUNDING', REPLAY: 'REPLAY',
  SCHEMA: 'SCHEMA', DEPENDENCY: 'DEPENDENCY', INTERNAL: 'INTERNAL',
});

const SHA256_RE=/^[a-f0-9]{64}$/;
const SENSITIVE_KEYS = new Set([
  'password','passwd','secret','clientsecret','client_secret','token','accesstoken','access_token','refreshtoken','refresh_token',
  'authorization','apikey','api_key','privatekey','private_key','nationalid','national_id','iqama','email','phone','mobile',
]);
const FORBIDDEN_AUTHORITY_KEYS = new Set([
  'transactionAuthorized','approvalAuthorized','publicAiAuthorized','productionDeploymentAuthorized',
  'canonicalBaselineActivationAuthorized','autonomousActionExecuted','decisionStateOverride','deterministicStateOverride',
]);

function canonicalize(v){
  if(Array.isArray(v)) return v.map(canonicalize);
  if(v && typeof v==='object') return Object.keys(v).sort().reduce((o,k)=>{o[k]=canonicalize(v[k]);return o;},{});
  return v;
}
function stable(v){return JSON.stringify(canonicalize(v));}
function hash(v){return crypto.createHash('sha256').update(typeof v==='string'?v:stable(v)).digest('hex');}
function text(v,c){if(typeof v!=='string'||!v.trim()) throw new Error(c); return v;}
function sha(v,c){if(typeof v!=='string'||!SHA256_RE.test(v)) throw new Error(c); return v;}
function iso(v,c){text(v,c); if(Number.isNaN(Date.parse(v))) throw new Error(c); return v;}
function normalizedKey(k){return String(k).replace(/[-\s]/g,'').toLowerCase();}

function containsAuthorityInjection(v){
  if(!v||typeof v!=='object') return false;
  if(Array.isArray(v)) return v.some(containsAuthorityInjection);
  return Object.entries(v).some(([k,n])=>FORBIDDEN_AUTHORITY_KEYS.has(k) || containsAuthorityInjection(n));
}

function redactSensitive(value){
  if(Array.isArray(value)) return value.map(redactSensitive);
  if(value && typeof value==='object'){
    return Object.keys(value).sort().reduce((out,key)=>{
      out[key]=SENSITIVE_KEYS.has(normalizedKey(key))?'[REDACTED]':redactSensitive(value[key]);
      return out;
    },{});
  }
  return value;
}

function eventMaterial(input){
  return {
    eventId:input.eventId,eventType:input.eventType,severity:input.severity,occurredAt:input.occurredAt,
    correlationRef:input.correlationRef,caseId:input.caseId||null,propertyRef:input.propertyRef||null,
    requestRef:input.requestRef||null,sessionRef:input.sessionRef||null,sourceComponent:input.sourceComponent,
    technicalHealth:input.technicalHealth,businessReadiness:input.businessReadiness||null,errorClass:input.errorClass||null,
    payload:input.payload,
    transactionAuthorized:false,approvalAuthorized:false,publicAiAuthorized:false,productionDeploymentAuthorized:false,
    commercialGoLive:'HOLD',canonicalBaselineActivationAuthorized:false,autonomousActionExecuted:false,
  };
}

function createTelemetryEvent(input){
  if(!input||typeof input!=='object') throw new Error('C27_EVENT_REQUIRED');
  if(!Object.values(EVENT_TYPE).includes(input.eventType)) throw new Error('C27_EVENT_TYPE_UNKNOWN');
  if(!Object.values(SEVERITY).includes(input.severity)) throw new Error('C27_SEVERITY_UNKNOWN');
  if(!Object.values(TECHNICAL_HEALTH).includes(input.technicalHealth)) throw new Error('C27_TECHNICAL_HEALTH_UNKNOWN');
  if(input.errorClass!=null&&!Object.values(ERROR_CLASS).includes(input.errorClass)) throw new Error('C27_ERROR_CLASS_UNKNOWN');
  if((input.caseId&&!input.propertyRef)||(!input.caseId&&input.propertyRef)) throw new Error('C27_CASE_PROPERTY_SCOPE_INCOMPLETE');
  if(containsAuthorityInjection(input.payload)) throw new Error('C27_AUTHORITY_INJECTION_FORBIDDEN');
  const payload=redactSensitive(input.payload===undefined?{}:input.payload);
  const material=eventMaterial({
    eventId:text(input.eventId,'C27_EVENT_ID_REQUIRED'),eventType:input.eventType,severity:input.severity,
    occurredAt:iso(input.occurredAt,'C27_OCCURRED_AT_INVALID'),correlationRef:text(input.correlationRef,'C27_CORRELATION_REF_REQUIRED'),
    caseId:input.caseId||null,propertyRef:input.propertyRef||null,requestRef:input.requestRef||null,sessionRef:input.sessionRef||null,
    sourceComponent:text(input.sourceComponent,'C27_SOURCE_COMPONENT_REQUIRED'),technicalHealth:input.technicalHealth,
    businessReadiness:input.businessReadiness||null,errorClass:input.errorClass||null,payload,
  });
  return Object.freeze({...material,eventHashSha256:hash(material)});
}

function verifyTelemetryEvent(event){
  if(!event||typeof event!=='object') return {valid:false,reason:'C27_EVENT_MISSING'};
  if(!SHA256_RE.test(event.eventHashSha256||'')) return {valid:false,reason:'C27_EVENT_HASH_INVALID'};
  const expected=hash(eventMaterial(event));
  if(expected!==event.eventHashSha256) return {valid:false,reason:'C27_EVENT_INTEGRITY_MISMATCH'};
  if(containsAuthorityInjection(event.payload)) return {valid:false,reason:'C27_AUTHORITY_INJECTION_FORBIDDEN'};
  return {valid:true,reason:null};
}

function createMetricObservation(input){
  if(!input||typeof input!=='object') throw new Error('C27_METRIC_REQUIRED');
  if(!Object.values(METRIC).includes(input.metric)) throw new Error('C27_METRIC_UNKNOWN');
  const isSwitch=input.metric===METRIC.KILL_SWITCH_ENGAGED;
  if(isSwitch){ if(typeof input.value!=='boolean') throw new Error('C27_KILL_SWITCH_METRIC_BOOLEAN_REQUIRED'); }
  else if(!Number.isSafeInteger(input.value)||input.value<0) throw new Error('C27_COUNT_METRIC_NONNEGATIVE_INTEGER_REQUIRED');
  const material={
    metricId:text(input.metricId,'C27_METRIC_ID_REQUIRED'),metric:input.metric,value:input.value,
    observedAt:iso(input.observedAt,'C27_METRIC_OBSERVED_AT_INVALID'),correlationRef:text(input.correlationRef,'C27_METRIC_CORRELATION_REQUIRED'),
    evidenceRef:text(input.evidenceRef,'C27_METRIC_EVIDENCE_REF_REQUIRED'),evidenceHashSha256:sha(input.evidenceHashSha256,'C27_METRIC_EVIDENCE_HASH_INVALID'),
    caseId:input.caseId||null,propertyRef:input.propertyRef||null,
  };
  if((material.caseId&&!material.propertyRef)||(!material.caseId&&material.propertyRef)) throw new Error('C27_CASE_PROPERTY_SCOPE_INCOMPLETE');
  return Object.freeze({...material,metricHashSha256:hash(material)});
}

function summarizeOperationalState({events,metrics,asOf}){
  iso(asOf,'C27_AS_OF_INVALID');
  if(!Array.isArray(events)||!Array.isArray(metrics)) throw new Error('C27_EVENTS_METRICS_REQUIRED');
  const blockers=[];
  for(const event of events){
    const verification=verifyTelemetryEvent(event);
    if(!verification.valid) blockers.push(verification.reason);
    if(Date.parse(event.occurredAt)>Date.parse(asOf)) blockers.push(`C27_FUTURE_EVENT:${event.eventId}`);
  }
  for(const metric of metrics){
    if(!metric||hash({metricId:metric.metricId,metric:metric.metric,value:metric.value,observedAt:metric.observedAt,correlationRef:metric.correlationRef,evidenceRef:metric.evidenceRef,evidenceHashSha256:metric.evidenceHashSha256,caseId:metric.caseId||null,propertyRef:metric.propertyRef||null})!==metric.metricHashSha256) blockers.push('C27_METRIC_INTEGRITY_MISMATCH');
    if(metric&&Date.parse(metric.observedAt)>Date.parse(asOf)) blockers.push(`C27_FUTURE_METRIC:${metric.metricId}`);
  }
  const healthRank={[TECHNICAL_HEALTH.HEALTHY]:0,[TECHNICAL_HEALTH.UNKNOWN]:1,[TECHNICAL_HEALTH.DEGRADED]:2,[TECHNICAL_HEALTH.UNAVAILABLE]:3};
  let technicalHealth=TECHNICAL_HEALTH.HEALTHY;
  for(const event of events){ if(healthRank[event.technicalHealth]>healthRank[technicalHealth]) technicalHealth=event.technicalHealth; }
  const killSwitch=metrics.filter(m=>m.metric===METRIC.KILL_SWITCH_ENGAGED).some(m=>m.value===true);
  if(killSwitch && healthRank[technicalHealth]<healthRank[TECHNICAL_HEALTH.DEGRADED]) technicalHealth=TECHNICAL_HEALTH.DEGRADED;
  const businessStates=[...new Set(events.map(e=>e.businessReadiness).filter(Boolean))].sort();
  const material={asOf,technicalHealth,businessReadinessObserved:businessStates,killSwitchEngaged:killSwitch,blockers:[...new Set(blockers)].sort(),eventHashesSha256:events.map(e=>e.eventHashSha256).sort(),metricHashesSha256:metrics.map(m=>m.metricHashSha256).sort()};
  return Object.freeze({
    ...material,telemetryIntegrityReady:blockers.length===0,
    technicalServiceHealthy:technicalHealth===TECHNICAL_HEALTH.HEALTHY && blockers.length===0,
    businessApprovalInferred:false,deterministicStateOverrideApplied:false,
    transactionAuthorized:false,approvalAuthorized:false,publicAiAuthorized:false,productionDeploymentAuthorized:false,
    commercialGoLive:'HOLD',canonicalBaselineActivationAuthorized:false,
    summaryHashSha256:hash(material),
  });
}

module.exports={EVENT_TYPE,SEVERITY,TECHNICAL_HEALTH,METRIC,ERROR_CLASS,redactSensitive,createTelemetryEvent,verifyTelemetryEvent,createMetricObservation,summarizeOperationalState};
