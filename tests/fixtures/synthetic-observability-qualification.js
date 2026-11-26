'use strict';
const crypto=require('node:crypto');
const {AUTHORITY,OBSERVABILITY_STATUS}=require('../../src/qualification/controlled-observability-incident-qualification');
const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const digest=v=>crypto.createHash('sha256').update(JSON.stringify(canonical(v))).digest('hex');
const ref=v=>'sha256:'+digest(v);
function syntheticObservability(scope){
 const planCore={schemaVersion:1,...scope,probeId:'SYNTH-OBS',assessedAt:'2026-09-04T12:00:00Z',assessmentMode:'RETROSPECTIVE_CUTOFF',monitoringObjectives:{requiredSignals:['latency'],maximumMetricFreshnessSeconds:30,maximumAlertDeliverySeconds:10,maximumIncidentAcknowledgeSeconds:60,objectiveSourceRef:'SYNTH-POLICY'},drFailoverQualificationRef:'sha256:'+'d'.repeat(64),executionOrder:['metricsInspection','syntheticAlert','incidentAcknowledgementAndRunbook']};
 const plan={...planCore,planHashSha256:digest(planCore)};
 const scopeRef=ref({...scope,probeId:'SYNTH-OBS'});
 const authorization={accepted:true,approvedBy:'SYNTH-OPS',reviewedBy:'SYNTH-REVIEW',approvedAt:'2026-09-04T10:00:00Z',changeControlRef:'SYNTH-CHANGE'};
 const metrics={scopeRef,observedAt:'2026-09-04T11:00:00Z',latestSampleAt:'2026-09-04T10:59:55Z',freshnessSeconds:5,queryHealthy:true,requiredSignalChecks:[{signal:'latency',present:true}],missingRequiredSignals:[],metricsBackendRef:ref('metrics')};
 const alert={scopeRef,triggeredAt:'2026-09-04T11:00:10Z',deliveredAt:'2026-09-04T11:00:14Z',deliverySeconds:4,deliveryConfirmed:true,alertIdRef:ref('alert'),routeRef:ref('route'),receiverRef:ref('receiver')};
 const incident={scopeRef,linkedAlertIdRef:alert.alertIdRef,openedAt:'2026-09-04T11:00:15Z',acknowledgedAt:'2026-09-04T11:00:35Z',resolvedAt:'2026-09-04T11:01:20Z',acknowledgeSecondsFromDelivery:21,acknowledgementConfirmed:true,runbookAvailable:true,incidentRef:ref('incident'),runbookRef:ref('runbook'),onCallOwnerRef:ref('owner'),escalationPolicyRef:ref('escalation')};
 const core={schemaVersion:1,status:OBSERVABILITY_STATUS.OBSERVABILITY_INCIDENT_EVIDENCE_COMPLETE_NOT_PRODUCTION_CERTIFIED,planHashSha256:plan.planHashSha256,reviewedAt:plan.assessedAt,drFailoverQualificationRef:plan.drFailoverQualificationRef,authorizationAccepted:true,authorizationRef:ref(authorization),metricsRef:ref(metrics),alertRef:ref(alert),incidentRef:ref(incident)};
 const evidenceHashSha256=digest(core);
 return {...core,plan,authorization,metrics,alert,incident,evidenceHashSha256,evidenceRef:'sha256:'+evidenceHashSha256,productionQualified:false,authority:{...AUTHORITY}};
}
module.exports={syntheticObservability};
