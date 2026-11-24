'use strict';
const {REVIEW_STATUS:S,SIGNAL_CLASS:C,OBSERVATION_STATE:O,METRIC_TYPE:M,ANALYSIS_TYPE:A,SOURCE_TIER:T,createUrbanGrowthAccessibilityEvidence:makeEvidence,createProfessionalUrbanGrowthAccessibilityPair:makePair,createUrbanGrowthAccessibilityReviewPolicy:makePolicy,evaluateGovernedUrbanGrowthAccessibility:evaluate}=require('../../src/geospatial/urban-growth-accessibility-review');
const scope={caseId:'SYNTH-C20',propertyRef:'SYNTH-PROPERTY',marketScopeRef:'SYNTH-MARKET'};
const asOf='2026-10-31';
function evidence(id,signalClass,signalKey,metricType,metricUnit,metricValue,referenceAt,patch={}){
 return makeEvidence({...scope,evidenceId:id,signalClass,signalKey,metricType,metricUnit,metricValue,referenceAt,observationState:O.OBSERVED_EXISTING,sourceCapability:'SYNTH-OBSERVATIONS',sourceProvider:'SYNTH-PROVIDER',sourceTier:T.A_OFFICIAL_AUTHORITATIVE,sourceRecordId:'SRC-'+id,sourceStatus:'SYNTHETIC-NOT-PUBLISHED',sourceReference:'REF-'+id,sourceRecordHashSha256:'a'.repeat(64),provenanceVerified:true,seriesRef:'SERIES-'+signalKey,measurementMethodRef:'METHOD-'+signalKey,geographyDefinitionRef:'BOUNDARY-V1',knownAt:'2026-10-04',reviewedAt:'2026-10-05',reviewedByRef:'SYNTH-REVIEWER',reviewEvidenceRef:'SYNTH-REVIEW',validUntil:'2026-12-31',...patch});
}
const b1=evidence('B1',C.POPULATION_OR_HOUSEHOLD_GROWTH,'POP',M.COUNT,'PERSONS',10000,'2025-09-30');
const c1=evidence('C1',C.POPULATION_OR_HOUSEHOLD_GROWTH,'POP',M.COUNT,'PERSONS',12000,'2026-09-30');
const b2=evidence('B2',C.ROAD_OR_TRANSIT_ACCESSIBILITY,'TRANSIT',M.TRAVEL_TIME_MINUTES,'MINUTES',40,'2025-09-30');
const c2=evidence('C2',C.ROAD_OR_TRANSIT_ACCESSIBILITY,'TRANSIT',M.TRAVEL_TIME_MINUTES,'MINUTES',30,'2026-09-30');
const b3=evidence('B3',C.BUILDING_PERMIT_OR_CONSTRUCTION_ACTIVITY,'PERMITS',M.COUNT,'PERMITS',0,'2025-09-30');
const c3=evidence('C3',C.BUILDING_PERMIT_OR_CONSTRUCTION_ACTIVITY,'PERMITS',M.COUNT,'PERMITS',25,'2026-09-30');
const planned=evidence('P1',C.PLANNED_INFRASTRUCTURE_OR_CORRIDOR,'CORRIDOR',M.DISTANCE_METERS,'METERS',800,'2028-01-01',{observationState:O.PLANNED_COMMITTED_NOT_DELIVERED,nonExistingStateRationaleRef:'SYNTH-PLAN'});
function pair(id,b,c,analysisType,patch={}){
 return makePair({...scope,pairId:id,signalKey:b.signalKey,analysisType,baselineEvidenceHashSha256:b.evidenceHashSha256,currentEvidenceHashSha256:c.evidenceHashSha256,rationaleRef:'SYNTH-RATIONALE',preparedByRef:'SYNTH-PREPARER',preparedAt:'2026-10-06',reviewedByRef:'SYNTH-REVIEWER',reviewedAt:'2026-10-07',reviewEvidenceRef:'SYNTH-REVIEW',validUntil:'2026-12-31',...patch});
}
const p1=pair('PAIR-1',b1,c1,A.GROWTH_DELTA),p2=pair('PAIR-2',b2,c2,A.ACCESSIBILITY_DELTA),p3=pair('PAIR-3',b3,c3,A.GROWTH_DELTA);
const allEvidence=[b1,c1,b2,c2,b3,c3,planned],allPairs=[p1,p2,p3];
function args(patch={},policyPatch={}){
 const input={asOf,evidence:allEvidence,pairs:allPairs,...patch};
 return {...input,reviewPolicy:makePolicy({...scope,policyId:'SYNTH-POLICY',allowedSignalClasses:Object.values(C),requiredSignalClasses:[C.POPULATION_OR_HOUSEHOLD_GROWTH,C.ROAD_OR_TRANSIT_ACCESSIBILITY,C.BUILDING_PERMIT_OR_CONSTRUCTION_ACTIVITY,C.PLANNED_INFRASTRUCTURE_OR_CORRIDOR],allowedAnalysisTypes:Object.values(A),allowedMetricTypes:Object.values(M),allowedSourceTiers:[T.A_OFFICIAL_AUTHORITATIVE,T.D_LICENSED_PROFESSIONAL],allowNonObservedContextEvidence:true,evidenceHashesSha256:[...new Set(input.evidence.map(e=>e.evidenceHashSha256))],pairHashesSha256:[...new Set(input.pairs.map(p=>p.pairHashSha256))],reviewedByRef:'SYNTH-REVIEWER',reviewEvidenceRef:'SYNTH-POLICY-REVIEW',reviewedAt:'2026-10-08',validUntil:'2026-12-31',...policyPatch})};
}
module.exports={args,scope,asOf,evidence,pair,allEvidence,allPairs,b1,c1,b2,c2,b3,c3,planned,p1,p2,p3,makeEvidence,makePair,makePolicy,evaluate,S,C,O,M,A,T};
