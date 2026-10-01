'use strict';

const assert = require('assert');
const {
  EVENT_TYPE, SEVERITY, TECHNICAL_HEALTH, METRIC, ERROR_CLASS,
  redactSensitive, createTelemetryEvent, verifyTelemetryEvent,
  createMetricObservation, summarizeOperationalState,
} = require('../../src/observability/governed-operational-telemetry');

const H=(c)=>c.repeat(64);
const AS_OF='2026-10-01T18:30:00Z';

const redacted=redactSensitive({apiKey:'real-key-must-not-log',nested:{email:'person@example.test',safe:'kept'},password:'secret'});
assert.strictEqual(redacted.apiKey,'[REDACTED]');
assert.strictEqual(redacted.nested.email,'[REDACTED]');
assert.strictEqual(redacted.password,'[REDACTED]');
assert.strictEqual(redacted.nested.safe,'kept');

function event(overrides={}){
  return createTelemetryEvent({
    eventId:'EVENT-C27-1',eventType:EVENT_TYPE.CASE_EVALUATED,severity:SEVERITY.INFO,occurredAt:'2026-10-01T18:00:00Z',
    correlationRef:'CORR-C27',caseId:'CASE-C27',propertyRef:'PROP-C27',requestRef:'REQ-C27',sessionRef:'SESSION-C27',
    sourceComponent:'case-orchestrator',technicalHealth:TECHNICAL_HEALTH.HEALTHY,businessReadiness:'HOLD',errorClass:null,
    payload:{resultRef:'RESULT-C27',apiKey:'must-be-redacted'},...overrides,
  });
}

const e=event();
assert.strictEqual(e.payload.apiKey,'[REDACTED]');
assert.strictEqual(e.transactionAuthorized,false);
assert.strictEqual(e.approvalAuthorized,false);
assert.strictEqual(e.publicAiAuthorized,false);
assert.strictEqual(e.productionDeploymentAuthorized,false);
assert.strictEqual(e.commercialGoLive,'HOLD');
assert.deepStrictEqual(verifyTelemetryEvent(e),{valid:true,reason:null});

const sourceEvent=event({
  eventId:'EVENT-C27-SOURCE',eventType:EVENT_TYPE.SOURCE_STATE,severity:SEVERITY.WARN,
  sourceComponent:'source-readiness',technicalHealth:TECHNICAL_HEALTH.DEGRADED,errorClass:ERROR_CLASS.SOURCE,
  payload:{sourceRef:'SOURCE-1',state:'OUTAGE'},
});
const sourceMetric=createMetricObservation({
  metricId:'METRIC-C27-OUTAGE',metric:METRIC.SOURCE_OUTAGE_COUNT,value:1,observedAt:'2026-10-01T18:00:00Z',
  correlationRef:'CORR-C27',evidenceRef:'SOURCE-OUTAGE-EVIDENCE',evidenceHashSha256:H('a'),caseId:'CASE-C27',propertyRef:'PROP-C27',
});
const aiMetric=createMetricObservation({
  metricId:'METRIC-C27-AI',metric:METRIC.AI_BLOCKED_OUTPUT_COUNT,value:2,observedAt:'2026-10-01T18:01:00Z',
  correlationRef:'CORR-C27',evidenceRef:'AI-GROUNDING-BLOCK-EVIDENCE',evidenceHashSha256:H('b'),caseId:'CASE-C27',propertyRef:'PROP-C27',
});
const summary=summarizeOperationalState({events:[e,sourceEvent],metrics:[sourceMetric,aiMetric],asOf:AS_OF});
assert.strictEqual(summary.telemetryIntegrityReady,true);
assert.strictEqual(summary.technicalHealth,TECHNICAL_HEALTH.DEGRADED);
assert.strictEqual(summary.technicalServiceHealthy,false);
assert.deepStrictEqual(summary.businessReadinessObserved,['HOLD']);
assert.strictEqual(summary.businessApprovalInferred,false);
assert.strictEqual(summary.deterministicStateOverrideApplied,false);
assert.strictEqual(summary.transactionAuthorized,false);
assert.strictEqual(summary.approvalAuthorized,false);
assert.strictEqual(summary.publicAiAuthorized,false);
assert.strictEqual(summary.commercialGoLive,'HOLD');

const healthySummary=summarizeOperationalState({events:[e],metrics:[],asOf:AS_OF});
assert.strictEqual(healthySummary.technicalServiceHealthy,true);
assert.deepStrictEqual(healthySummary.businessReadinessObserved,['HOLD']);
assert.strictEqual(healthySummary.businessApprovalInferred,false);

const killSwitch=createMetricObservation({
  metricId:'METRIC-C27-KILL',metric:METRIC.KILL_SWITCH_ENGAGED,value:true,observedAt:'2026-10-01T18:02:00Z',
  correlationRef:'CORR-C27',evidenceRef:'KILL-SWITCH-EVIDENCE',evidenceHashSha256:H('c'),
});
const killSummary=summarizeOperationalState({events:[e],metrics:[killSwitch],asOf:AS_OF});
assert.strictEqual(killSummary.killSwitchEngaged,true);
assert.strictEqual(killSummary.technicalHealth,TECHNICAL_HEALTH.DEGRADED);
assert.strictEqual(killSummary.businessApprovalInferred,false);

const tampered={...e,payload:{...e.payload,resultRef:'TAMPERED'}};
assert.strictEqual(verifyTelemetryEvent(tampered).valid,false);
const tamperedSummary=summarizeOperationalState({events:[tampered],metrics:[],asOf:AS_OF});
assert.strictEqual(tamperedSummary.telemetryIntegrityReady,false);
assert(tamperedSummary.blockers.includes('C27_EVENT_INTEGRITY_MISMATCH'));

const future=event({eventId:'EVENT-C27-FUTURE',occurredAt:'2026-10-02T18:00:00Z'});
const futureSummary=summarizeOperationalState({events:[future],metrics:[],asOf:AS_OF});
assert.strictEqual(futureSummary.telemetryIntegrityReady,false);
assert(futureSummary.blockers.includes('C27_FUTURE_EVENT:EVENT-C27-FUTURE'));

const tamperedMetric={...sourceMetric,value:99};
const metricSummary=summarizeOperationalState({events:[e],metrics:[tamperedMetric],asOf:AS_OF});
assert.strictEqual(metricSummary.telemetryIntegrityReady,false);
assert(metricSummary.blockers.includes('C27_METRIC_INTEGRITY_MISMATCH'));

assert.throws(()=>createTelemetryEvent({
  eventId:'EVENT-INJECTION',eventType:EVENT_TYPE.RBAC_ACTION,severity:SEVERITY.INFO,occurredAt:'2026-10-01T18:00:00Z',
  correlationRef:'CORR',sourceComponent:'rbac',technicalHealth:TECHNICAL_HEALTH.HEALTHY,payload:{approvalAuthorized:true},
}),/C27_AUTHORITY_INJECTION_FORBIDDEN/);

assert.throws(()=>createMetricObservation({
  metricId:'METRIC-BAD',metric:METRIC.SOURCE_STALE_COUNT,value:-1,observedAt:'2026-10-01T18:00:00Z',correlationRef:'CORR',evidenceRef:'E',evidenceHashSha256:H('d'),
}),/C27_COUNT_METRIC_NONNEGATIVE_INTEGER_REQUIRED/);

console.log('C27_GOVERNED_OBSERVABILITY_OPERATIONAL_SAFETY=PASS');
