'use strict';

const assert = require('assert');
const {
  CONFLICT_INDEPENDENCE_STATUS,
  COMPETENCE_STATUS,
  RIGHT_TYPE,
  RIGHT_SOURCE_CLASS,
} = require('../../src/valuation/professional-assignment');
const {
  TRUTH_STATUS,
  VERIFICATION_STATUS,
} = require('../../src/document-intelligence/contracts');
const {
  EVIDENCE_SOURCE_ROLE,
  EVIDENCE_SENSITIVITY_CLASS,
  EXTRACTOR_TYPE,
  PROFESSIONAL_REVIEW_OUTCOME,
  createProfessionalEvidenceChainRecord,
  recordProfessionalEvidenceReview,
} = require('../../src/document-intelligence/professional-evidence-chain');
const {
  createInspectionCase,
  qualifyPreInspection,
  startInspection,
  addInspectionObservation,
  createInspectionMediaRecord,
  addInspectionMedia,
  submitPostInspectionReview,
  completeInspection,
  OBSERVATION_CATEGORY,
  MEDIA_MANIPULATION_STATUS,
} = require('../../src/inspection/inspection-lifecycle');
const {
  MEASUREMENT_TYPE,
  MEASUREMENT_SOURCE,
  createMeasurementRecord,
  reconcileMeasurementRecords,
} = require('../../src/inspection/measurement-governance');
const {
  PROPERTY_EVIDENCE_PACKET_STATUS,
  buildPropertyEvidencePacket,
} = require('../../src/property/property-evidence-bridge');

let checks = 0;
function check(condition, message) {
  assert.ok(condition, message);
  checks += 1;
}
function throwsWith(fn, fragment, message) {
  let ok = false;
  try { fn(); } catch (error) { ok = String(error.message).includes(fragment); }
  check(ok, message);
}

const CASE_ID = 'CASE-8C-001';
const PROPERTY_REF = 'PROPERTY-8C-001';
const INSPECTION_ID = 'INSP-8C-001';
const GPS = { lat: 24.7136, long: 46.6753, accuracyMeters: 5 };

function assignment(overrides = {}) {
  return {
    client: 'SYNTHETIC CLIENT',
    intended_user: 'INVESTMENT_COMMITTEE',
    intended_use: 'INTERNAL_INVESTMENT_DECISION_SUPPORT',
    purpose: 'ACQUISITION_ANALYSIS',
    asset: { type: 'OFFICE', jurisdiction: 'SAUDI_ARABIA', location: 'SYNTHETIC_RIYADH_LOCATION' },
    rights: [{ type: RIGHT_TYPE.OWNERSHIP, source_class: RIGHT_SOURCE_CLASS.VERIFIED, description: 'Synthetic verified ownership interest', source_reference: 'DOC-TITLE' }],
    basis: 'SYNTHETIC_MARKET_VALUE_BASIS',
    valuation_date: '2026-09-07',
    report_date: '2026-09-07',
    scope: 'Synthetic professional valuation scope',
    assumptions: [],
    special_assumptions: [],
    information_reliance: ['DOC-TITLE'],
    limitations: [],
    conflicts: { status: CONFLICT_INDEPENDENCE_STATUS.CLEAR, notes: null },
    independence: { status: CONFLICT_INDEPENDENCE_STATUS.CLEAR, notes: null },
    competence: { status: COMPETENCE_STATUS.CLEAR, location: 'RIYADH', complexity: 'STANDARD', specialization_required: false, specialist_reviewer: null },
    reviewer: 'SYNTHETIC_REVIEWER',
    transaction_context: 'ACQUISITION',
    ...overrides,
  };
}

function fact({ id, sourceKey, value = 1000, hashChar = 'a', verified = true }) {
  return {
    schemaVersion: 1,
    factId: id,
    caseId: CASE_ID,
    documentId: `DOC-${id}`,
    documentHashSha256: hashChar.repeat(64),
    documentType: sourceKey,
    authorityClass: 'OFFICIAL_OR_FIELD_EVIDENCE',
    authorityVerified: true,
    key: 'property.land_area',
    rawValue: String(value),
    normalizedValue: value,
    valueType: 'NUMBER',
    unit: 'sqm',
    sourceLocator: { kind: 'PAGE_OR_FIELD', reference: `${sourceKey}:1` },
    extraction: { method: 'STRUCTURED_CAPTURE', confidence: 0.99 },
    materiality: 'MATERIAL',
    truthStatus: verified ? TRUTH_STATUS.VERIFIED_FACT : TRUTH_STATUS.EXTRACTED_EVIDENCE,
    verification: verified
      ? { status: VERIFICATION_STATUS.VERIFIED, method: 'HUMAN_SOURCE_CHECK', verifierType: 'VALUATION_ANALYST', reference: `VERIFY-${id}`, verifiedAt: '2026-09-07T08:30:00Z' }
      : { status: VERIFICATION_STATUS.NOT_VERIFIED, method: null, verifierType: null, reference: null, verifiedAt: null },
    capturedAt: '2026-09-07T08:20:00Z',
  };
}

function reviewedEvidence({ id, sourceRole, value = 1000, hashChar = 'a', verified = true }) {
  const chain = createProfessionalEvidenceChainRecord({
    recordId: `CHAIN-${id}`,
    fact: fact({ id, sourceKey: sourceRole, value, hashChar, verified }),
    sourceRole,
    sourceReference: `SOURCE-${id}`,
    evidenceLink: `evidence://${id}`,
    extractor: { type: EXTRACTOR_TYPE.SYSTEM, name: 'STARTAK_DOCUMENT_PIPELINE', version: '8C.1' },
    capturedByRef: 'SYSTEM:document-intelligence',
    sensitivityClass: EVIDENCE_SENSITIVITY_CLASS.MATERIAL,
    createdAt: '2026-09-07T08:20:00Z',
  });
  if (!verified) return chain;
  return recordProfessionalEvidenceReview({
    record: chain,
    review: {
      reviewId: `REVIEW-${id}`,
      outcome: PROFESSIONAL_REVIEW_OUTCOME.APPROVED,
      reviewedByRef: 'USER:VALUATION-REVIEWER',
      reviewEvidenceRef: `review://${id}`,
      reviewedAt: '2026-09-07T08:35:00Z',
      acknowledgements: {
        sourceViewed: true,
        locatorChecked: true,
        semanticMappingChecked: true,
        documentHashChecked: true,
        accountabilityAccepted: true,
      },
    },
  });
}

function measurements({ conflict = false } = {}) {
  return [
    createMeasurementRecord({
      measurementId: 'M-TITLE', caseId: CASE_ID, type: MEASUREMENT_TYPE.LAND_AREA, valueSqm: 1000,
      source: MEASUREMENT_SOURCE.TITLE_DEED, sourceEvidenceRef: 'evidence://title/area', measurementStandardRef: 'SYNTHETIC-MEASUREMENT-STANDARD',
      measurementMethod: 'DOCUMENT_REPORTED_AREA', measuredByRef: 'USER:ANALYST', measuredAt: '2026-09-07T07:00:00Z',
    }),
    createMeasurementRecord({
      measurementId: 'M-INSP', caseId: CASE_ID, inspectionId: INSPECTION_ID, type: MEASUREMENT_TYPE.LAND_AREA, valueSqm: conflict ? 1100 : 1001,
      source: MEASUREMENT_SOURCE.INSPECTION, sourceEvidenceRef: 'evidence://inspection/area', measurementStandardRef: 'SYNTHETIC-MEASUREMENT-STANDARD',
      measurementMethod: 'SITE_MEASUREMENT', measuredByRef: 'USER:INSPECTOR', measuredAt: '2026-09-07T08:15:00Z',
    }),
  ];
}

function completedInspection(measurementRecords,additionalPolicy={}) {
  const measurementInputs={
    caseId: CASE_ID,
    records: measurementRecords,
    materialTypes: [MEASUREMENT_TYPE.LAND_AREA],
    toleranceByType: { LAND_AREA: { absoluteSqm: 2 } },
    minimumIndependentSourcesByType: { LAND_AREA: 2 },...additionalPolicy,
  };
  const gate=reconcileMeasurementRecords(measurementInputs);
  let record = createInspectionCase({
    inspectionId: INSPECTION_ID, caseId: CASE_ID, propertyRef: PROPERTY_REF,
    valuationDate: '2026-09-07T00:00:00Z', plannedAt: '2026-09-07T08:00:00Z', leadInspectorRef: 'USER:INSPECTOR', scope: 'Synthetic inspection scope',
  });
  record = qualifyPreInspection(record, {
    checklist: { accessAuthorized: true, titleEvidencePrepared: true, planEvidencePrepared: true, safetyPlanPrepared: true, equipmentPrepared: true, conflictsReviewed: true, locationVerified: true },
    evidenceRefs: ['evidence://title', 'evidence://plan'], preparedByRef: 'USER:INSPECTOR', preparedAt: '2026-09-07T07:30:00Z',
  });
  record = startInspection(record, { startedAt: '2026-09-07T08:00:00Z', siteAnchorGps: GPS, deviceRef: 'DEVICE-1' });
  let minute = 1;
  for (const category of [OBSERVATION_CATEGORY.CONDITION, OBSERVATION_CATEGORY.OCCUPANCY, OBSERVATION_CATEGORY.CONSTRUCTION, OBSERVATION_CATEGORY.MEP, OBSERVATION_CATEGORY.SURROUNDINGS, OBSERVATION_CATEGORY.DEFECT]) {
    record = addInspectionObservation(record, {
      observationId: `OBS-${category}`, category, note: `${category} reviewed`, observedAt: `2026-09-07T08:0${minute}:00Z`, gps: GPS, evidenceRef: `evidence://inspection/${category}`,
    });
    minute += 1;
  }
  record = addInspectionMedia(record, createInspectionMediaRecord({
    mediaId: 'MEDIA-1', caseId: CASE_ID, inspectionId: INSPECTION_ID, fileRef: 'storage://photo.jpg', contentHashSha256: 'f'.repeat(64),
    capturedAt: '2026-09-07T08:10:00Z', gps: GPS, deviceRef: 'DEVICE-1', manipulationStatus: MEDIA_MANIPULATION_STATUS.PASS,
    manipulationEvidenceRef: 'evidence://media/pass',
  }));
  record = submitPostInspectionReview(record, {
    endedAt: '2026-09-07T09:00:00Z', reviewedByRef: 'USER:REVIEWER', reviewEvidenceRef: 'review://inspection',
    acknowledgements: { observationsReviewed: true, mediaReviewed: true, measurementsReviewed: true, materialConflictsReviewed: true, accountabilityAccepted: true },
    measurementGate: gate,measurementInputs,
  });
  if (!gate.readyForInspectionCompletion) return record;
  return completeInspection(record, { completedAt: '2026-09-07T09:05:00Z' });
}

const goodMeasurements = measurements();
const goodInspection = completedInspection(goodMeasurements);
const goodEvidence = [
  reviewedEvidence({ id: 'DEED', sourceRole: EVIDENCE_SOURCE_ROLE.TITLE_DEED, value: 1000, hashChar: 'a' }),
  reviewedEvidence({ id: 'INSP', sourceRole: EVIDENCE_SOURCE_ROLE.INSPECTION, value: 1000, hashChar: 'b' }),
];

const ready = buildPropertyEvidencePacket({
  caseId: CASE_ID, propertyRef: PROPERTY_REF, assignmentRef: 'ASSIGNMENT-001', assignment: assignment(), inspection: goodInspection,
  evidenceRecords: goodEvidence, measurementRecords: goodMeasurements, materialPropertyKeys: ['property.land_area'], materialMeasurementTypes: [MEASUREMENT_TYPE.LAND_AREA],
  evidenceToleranceByKey: { 'property.land_area': { absolute: 2 } }, measurementToleranceByType: { LAND_AREA: { absoluteSqm: 2 } },
  minimumPropertySourceRoles: 2, minimumMeasurementSourcesByType: { LAND_AREA: 2 },
});
check(ready.status === PROPERTY_EVIDENCE_PACKET_STATUS.READY_FOR_PROFESSIONAL_VALUATION_WORKFLOW, 'complete packet is professional-workflow ready');
check(ready.professionalValuationWorkflowReady === true, 'ready packet signals professional workflow handoff only');
check(ready.evidenceFacts.length === 2, 'packet preserves verified evidence facts');
check(ready.measurements.length === 2, 'packet preserves measurement provenance');
check(ready.evidenceFacts.every((item) => item.verificationReference && item.chainHashSha256), 'evidence facts retain verification and chain provenance');
check(ready.measurements.every((item) => item.measurementStandardRef === 'SYNTHETIC-MEASUREMENT-STANDARD'), 'measurements retain applied-standard reference');
check(/^[a-f0-9]{64}$/.test(ready.packetHashSha256), 'packet has immutable content hash');
check(ready.automaticUnderwritingAdoption === false && ready.financialEngineInputsWritten === false, 'property packet never automatically writes underwriting inputs');
check(ready.certifiedValuationEstablished === false && ready.transactionAuthorized === false, 'property packet creates no certification or transaction authority');
check(Object.isFrozen(ready) === true && Object.isFrozen(ready.evidenceFacts) === true, 'property packet is immutable');

const badAssignment = buildPropertyEvidencePacket({
  caseId: CASE_ID, propertyRef: PROPERTY_REF, assignmentRef: 'A', assignment: assignment({ basis: '' }), inspection: goodInspection,
  evidenceRecords: goodEvidence, measurementRecords: goodMeasurements, materialPropertyKeys: ['property.land_area'], materialMeasurementTypes: [MEASUREMENT_TYPE.LAND_AREA],
});
check(badAssignment.status === PROPERTY_EVIDENCE_PACKET_STATUS.HOLD_ASSIGNMENT, 'incomplete valuation assignment holds property packet');

const forgedInspection = { ...goodInspection, observations: [] };
const heldInspection = buildPropertyEvidencePacket({
  caseId: CASE_ID, propertyRef: PROPERTY_REF, assignmentRef: 'A', assignment: assignment(), inspection: forgedInspection,
  evidenceRecords: goodEvidence, measurementRecords: goodMeasurements, materialPropertyKeys: ['property.land_area'], materialMeasurementTypes: [MEASUREMENT_TYPE.LAND_AREA],
});
check(heldInspection.status === PROPERTY_EVIDENCE_PACKET_STATUS.HOLD_INSPECTION, 'forged/incomplete completed inspection fails bridge integrity checks');
check(heldInspection.reasons.some((item) => item.startsWith('INSPECTION_OBSERVATIONS_INCOMPLETE:')), 'inspection hold identifies missing professional categories');

const badMeasurements = measurements({ conflict: true });
const heldMeasurement = buildPropertyEvidencePacket({
  caseId: CASE_ID, propertyRef: PROPERTY_REF, assignmentRef: 'A', assignment: assignment(), inspection: goodInspection,
  evidenceRecords: goodEvidence, measurementRecords: badMeasurements, materialPropertyKeys: ['property.land_area'], materialMeasurementTypes: [MEASUREMENT_TYPE.LAND_AREA],
  measurementToleranceByType: { LAND_AREA: { absoluteSqm: 2 } },
});
check(heldMeasurement.status === PROPERTY_EVIDENCE_PACKET_STATUS.HOLD_MEASUREMENT, 'measurement conflict blocks property packet');

const unverifiedEvidence = [goodEvidence[0], reviewedEvidence({ id: 'UNVER', sourceRole: EVIDENCE_SOURCE_ROLE.INSPECTION, value: 1000, hashChar: 'c', verified: false })];
const heldEvidence = buildPropertyEvidencePacket({
  caseId: CASE_ID, propertyRef: PROPERTY_REF, assignmentRef: 'A', assignment: assignment(), inspection: goodInspection,
  evidenceRecords: unverifiedEvidence, measurementRecords: goodMeasurements, materialPropertyKeys: ['property.land_area'], materialMeasurementTypes: [MEASUREMENT_TYPE.LAND_AREA],
  measurementToleranceByType: { LAND_AREA: { absoluteSqm: 2 } },
});
check(heldEvidence.status === PROPERTY_EVIDENCE_PACKET_STATUS.HOLD_EVIDENCE, 'unverified evidence cannot enter professional property packet');

const conflictingEvidence = [goodEvidence[0], reviewedEvidence({ id: 'CONFLICT', sourceRole: EVIDENCE_SOURCE_ROLE.INSPECTION, value: 1200, hashChar: 'd' })];
const materialConflict = buildPropertyEvidencePacket({
  caseId: CASE_ID, propertyRef: PROPERTY_REF, assignmentRef: 'A', assignment: assignment(), inspection: goodInspection,
  evidenceRecords: conflictingEvidence, measurementRecords: goodMeasurements, materialPropertyKeys: ['property.land_area'], materialMeasurementTypes: [MEASUREMENT_TYPE.LAND_AREA],
  evidenceToleranceByKey: { 'property.land_area': { absolute: 2 } }, measurementToleranceByType: { LAND_AREA: { absoluteSqm: 2 } },
});
check(materialConflict.status === PROPERTY_EVIDENCE_PACKET_STATUS.MATERIAL_PROPERTY_DATA_CONFLICT, 'deed/inspection material disagreement emits canonical property conflict');
check(materialConflict.professionalValuationWorkflowReady === false, 'material property conflict blocks professional valuation workflow handoff');

throwsWith(() => buildPropertyEvidencePacket({
  caseId: 'CASE-OTHER', propertyRef: PROPERTY_REF, assignmentRef: 'A', assignment: assignment(), inspection: goodInspection,
  evidenceRecords: goodEvidence, measurementRecords: goodMeasurements, materialPropertyKeys: ['property.land_area'], materialMeasurementTypes: [MEASUREMENT_TYPE.LAND_AREA],
}), 'PROPERTY_CASE_ISOLATION_VIOLATION', 'cross-case inspection/evidence cannot be bridged');


const packet=(overrides={})=>buildPropertyEvidencePacket({
 caseId:CASE_ID,propertyRef:PROPERTY_REF,assignmentRef:'ASSIGNMENT-001',assignment:assignment(),inspection:goodInspection,
 evidenceRecords:goodEvidence,measurementRecords:goodMeasurements,materialPropertyKeys:['property.land_area'],materialMeasurementTypes:[MEASUREMENT_TYPE.LAND_AREA],
 evidenceToleranceByKey:{'property.land_area':{absolute:2}},measurementToleranceByType:{LAND_AREA:{absoluteSqm:2}},
 minimumPropertySourceRoles:2,minimumMeasurementSourcesByType:{LAND_AREA:2},...overrides});
const makeMeasurement=(r,overrides={})=>createMeasurementRecord({...r,valueSqm:r.value,...overrides});
check(packet({measurementRecords:[goodMeasurements[0],{...goodMeasurements[1],value:1000}]}).status===PROPERTY_EVIDENCE_PACKET_STATUS.HOLD_MEASUREMENT,'tampered measurement rejected');
check(packet({measurementRecords:[goodMeasurements[0],makeMeasurement(goodMeasurements[1],{inspectionId:'OTHER'})]}).status===PROPERTY_EVIDENCE_PACKET_STATUS.HOLD_MEASUREMENT,'foreign inspection rejected');
check(packet({measurementRecords:[goodMeasurements[0],makeMeasurement(goodMeasurements[1],{measuredAt:'2026-09-08'})]}).status===PROPERTY_EVIDENCE_PACKET_STATUS.HOLD_MEASUREMENT,'post-completion measurement rejected');
check(packet({inspection:{...goodInspection,valuationDate:'2026-09-06'}}).status===PROPERTY_EVIDENCE_PACKET_STATUS.HOLD_INSPECTION,'valuation date mismatch rejected');
check(packet({inspection:{...goodInspection,completedAt:'2026-09-08'}}).status===PROPERTY_EVIDENCE_PACKET_STATUS.HOLD_INSPECTION,'post-report inspection rejected');
const otherLand=goodMeasurements.map(r=>makeMeasurement(r,{valueSqm:1200}));
check(packet({measurementRecords:otherLand}).status===PROPERTY_EVIDENCE_PACKET_STATUS.MATERIAL_PROPERTY_DATA_CONFLICT,'individually consistent but mutually contradictory evidence layers blocked');
check(packet({measurementRecords:[goodMeasurements[0],makeMeasurement(goodMeasurements[1],{measurementStandardRef:'OTHER'})]}).status===PROPERTY_EVIDENCE_PACKET_STATUS.HOLD_MEASUREMENT,'different measurement standards blocked');
check(packet({measurementRecords:[goodMeasurements[0],makeMeasurement(goodMeasurements[1],{sourceEvidenceRef:goodMeasurements[0].sourceEvidenceRef})]}).status===PROPERTY_EVIDENCE_PACKET_STATUS.HOLD_MEASUREMENT,'duplicate source reference rejected');
check(packet({measurementRecords:[goodMeasurements[0],makeMeasurement(goodMeasurements[1],{measurementId:goodMeasurements[0].measurementId})]}).status===PROPERTY_EVIDENCE_PACKET_STATUS.HOLD_MEASUREMENT,'duplicate measurement id rejected');
const wide=[makeMeasurement(goodMeasurements[0],{valueSqm:1000}),makeMeasurement(goodMeasurements[1],{valueSqm:998}),makeMeasurement(goodMeasurements[1],{measurementId:'M-THIRD',source:'SURVEY',sourceEvidenceRef:'evidence://third',valueSqm:1002})];
check(packet({measurementRecords:wide}).status===PROPERTY_EVIDENCE_PACKET_STATUS.HOLD_MEASUREMENT,'nontransitive tolerance cannot hide conflicting extremes');
check(ready.evidenceFacts.every(x=>x.factHashSha256&&x.reviewBindingSha256),'packet retains full fact and review digests');
check(!!ready.measurementGateHashSha256&&!!ready.propertyDataGateHashSha256,'both gate results bound in packet');

check(packet({inspection:JSON.parse(JSON.stringify(goodInspection))}).status===PROPERTY_EVIDENCE_PACKET_STATUS.READY_FOR_PROFESSIONAL_VALUATION_WORKFLOW,'serialized inspection replays');
check(packet({inspection:{...goodInspection,observations:goodInspection.observations.map((o,i)=>i===0?{...o,note:'changed after review'}:o)}}).status===PROPERTY_EVIDENCE_PACKET_STATUS.HOLD_INSPECTION,'changed field observation rejected');
check(packet({inspection:{...goodInspection,postInspectionReview:{...goodInspection.postInspectionReview,reviewedByRef:'OTHER'}}}).status===PROPERTY_EVIDENCE_PACKET_STATUS.HOLD_INSPECTION,'reviewer substitution rejected');
check(packet({inspection:{...goodInspection,media:goodInspection.media.map(m=>({...m,contentHashSha256:'0'.repeat(64)}))}}).status===PROPERTY_EVIDENCE_PACKET_STATUS.HOLD_INSPECTION,'media content hash replacement rejected');
check(packet({measurementRecords:[goodMeasurements[0],makeMeasurement(goodMeasurements[1],{valueSqm:1000})]}).status===PROPERTY_EVIDENCE_PACKET_STATUS.HOLD_INSPECTION,'even within-tolerance changed measurement needs renewed review');
check(packet({measurementToleranceByType:{LAND_AREA:{absoluteSqm:3}}}).status===PROPERTY_EVIDENCE_PACKET_STATUS.HOLD_INSPECTION,'changed tolerance requires renewed review');
check(packet({minimumMeasurementSourcesByType:{LAND_AREA:1}}).status===PROPERTY_EVIDENCE_PACKET_STATUS.HOLD_INSPECTION,'lower source requirement requires renewed review');
check(packet({inspection:{...goodInspection,reviewBindingSha256:undefined}}).status===PROPERTY_EVIDENCE_PACKET_STATUS.HOLD_INSPECTION,'legacy unbound review held');
check(ready.inspectionReviewBindingSha256===goodInspection.reviewBindingSha256,'handoff preserves inspection review digest');
console.log(`WAVE_8C_PROPERTY_EVIDENCE_BRIDGE=PASS checks=${checks}`);

 // V6.54 — positive cost source chain using actual synthetic inspection and evidence fixture.
 const cost54=require('../../src/cost/cost-approach-inputs');
 const {calculateCostApproachIndication}=require('../../src/engines/valuation/cost-approach');
 const {evaluateSourceInputReplay}=require('../../src/valuation-reconciliation/source-input-replay');
 const scope54={caseId:CASE_ID,propertyRef:PROPERTY_REF,valuationDate:'2026-09-07T00:00:00Z'};
 const propertyDraft54={caseId:CASE_ID,propertyRef:PROPERTY_REF,assignmentRef:'ASSIGNMENT-001',assignment:assignment(),inspection:goodInspection,evidenceRecords:goodEvidence,measurementRecords:goodMeasurements,materialPropertyKeys:['property.land_area'],materialMeasurementTypes:[MEASUREMENT_TYPE.LAND_AREA],evidenceToleranceByKey:{'property.land_area':{absolute:2}},measurementToleranceByType:{LAND_AREA:{absoluteSqm:2}},minimumPropertySourceRoles:2,minimumMeasurementSourcesByType:{LAND_AREA:2}};
 const reviewed54={caseId:CASE_ID,propertyRef:PROPERTY_REF,rationale:'SYNTHETIC',evidenceRefs:['EVID'],preparedByRef:'V',preparedAt:'2026-09-07T09:10:00Z',reviewedByRef:'R',reviewedAt:'2026-09-07T09:20:00Z',reviewEvidenceRef:'REV'};
 const costRecord54=cost54.createCostComponentRecord({...scope54,componentId:'COST54',componentClass:'STRUCTURE',description:'SYNTHETIC',quantity:1000,unit:'sqm',unitCostSar:2000,costBasis:'REPLACEMENT_COST_NEW',sourceClass:'VERIFIED_QUANTITY_SURVEY',sourceName:'SYNTHETIC',sourceRef:'QUOTE',sourceDate:'2026-09-01',capturedAt:'2026-09-02T09:00:00Z',verification:{status:'VERIFIED',verifiedByRef:'R',verifiedAt:'2026-09-02T10:00:00Z',verificationEvidenceRef:'REV'}});
 const value54=cost54.createProfessionalLandValueInput({...reviewed54,valuationDate:scope54.valuationDate,landValueId:'LAND54',valueSar:1000000,methodReference:'SALES_COMPARISON'});
 const dep54=cost54.createDepreciationRecord({...reviewed54,depreciationId:'DEP54',type:'PHYSICAL_INCURABLE',method:'PERCENT_OF_IMPROVEMENT_COST_NEW',magnitude:0.1});
 const costDraft54={...scope54,packetId:'COST54',propertyEvidencePacket:ready,costComponents:[costRecord54],landValueInput:value54,depreciationRecords:[dep54],allowedCostSourceClasses:['VERIFIED_QUANTITY_SURVEY'],maxCostSourceAgeDays:365,preparedByRef:'V',preparedAt:'2026-09-07T10:00:00Z',packetEvidenceRef:'PACKET'};
 const cp54=cost54.buildCostApproachInputPacket(costDraft54),cr54=calculateCostApproachIndication(cp54);
 const replay54={...scope54,asOf:'2026-09-08T00:00:00Z',methodIndications:[{id:'C',sourceResult:cr54}],methodInputPacketsByIndicationId:{C:cp54},sourceRebuildsByIndicationId:{C:{methodInputDraft:costDraft54,propertyEvidenceDraft:propertyDraft54}}};
 const out54=evaluateSourceInputReplay(replay54);check(out54.status==='READY_FOR_SOURCE_INPUT_REPLAY_REVIEW',JSON.stringify(out54.blockers));check(cr54.costApproachValueIndicationSar===2800000,'cost source replay 2.8m');check(out54.originalSourceInputsIndependentlyRebuilt===false,'external evidence remains unverified');
 function reject54(draft,propertyDraft=propertyDraft54){const o=evaluateSourceInputReplay({...replay54,sourceRebuildsByIndicationId:{C:{methodInputDraft:draft,propertyEvidenceDraft:propertyDraft}}});check(o.status==='HOLD_SOURCE_INPUT_REPLAY'&&o.traces.length===0,JSON.stringify(o));}
 reject54(costDraft54,null);reject54(costDraft54,{...propertyDraft54,propertyRef:'OTHER'});reject54(costDraft54,{...propertyDraft54,inspection:{...goodInspection,observations:[]}});reject54({...costDraft54,propertyEvidencePacket:{...ready,packetHashSha256:'a'.repeat(64)}});reject54({...costDraft54,costComponents:[{...costRecord54,unitCostSar:1}]});reject54({...costDraft54,landValueInput:{...value54,valueSar:1}});reject54({...costDraft54,depreciationRecords:[{...dep54,magnitude:0.9}]});
 console.log('V654_COST_SOURCE_REPLAY=PASS synthetic=true sourceAuthority=false');

 // V6.55 — actual bridge -> land/whole-property calculation, no synthetic packet digest.
 const cmp55=require('../../src/market/comparable-evidence'),adj55=require('../../src/market/comparable-adjustments');
 const land55=require('../../src/land/land-valuation-inputs'),whole55=require('../../src/valuation/whole-property-sales-comparison-input');
 const {calculateLandSalesComparisonIndication}=require('../../src/engines/valuation/land-sales-comparison');
 const {calculateWholePropertySalesComparisonIndication}=require('../../src/engines/valuation/whole-property-sales-comparison');
 const asOf55='2026-09-08T00:00:00Z',select55='2026-09-07T09:15:00Z',review55='2026-09-07T09:30:00Z',reconcile55='2026-09-07T10:00:00Z';
 const propertyLand55={...propertyDraft54,assignment:assignment({asset:{type:'LAND',jurisdiction:'SAUDI_ARABIA',location:'SYNTHETIC_RIYADH_LOCATION'}})};
 const landProperty55=buildPropertyEvidencePacket(propertyLand55);
 const ids55=['L1','L2','L3'];
 const rec55=ids55.map((id,i)=>cmp55.createComparableEvidenceRecord({comparableId:id,caseId:CASE_ID,sourcePropertyRef:'LAND-'+id,assetType:'LAND',transactionType:'SALE',evidenceLevel:'VERIFIED_TRANSACTION',sourceName:'SYNTHETIC',sourceRef:'SRC-'+id,sourceDate:'2026-08-01',transactionDate:'2026-07-31',capturedAt:'2026-08-03',location:{city:'RIYADH',district:'SYNTHETIC'},areaSqm:1000,amountSar:[1000000,1100000,900000][i],verification:{status:'VERIFIED',verifiedByRef:'R',verifiedAt:'2026-08-02',evidenceRef:'REV-'+id}}));
 const rationale55=Object.fromEntries(ids55.map(id=>[id,'SYNTHETIC REVIEW']));
 const q55={caseId:CASE_ID,asOfDate:scope54.valuationDate,maxAgeDays:365,minimumComparableCount:3,minimumEvidenceLevel:'VERIFIED_TRANSACTION',targetAssetType:'LAND',targetTransactionType:'SALE',targetCity:'RIYADH'};
 const p55={caseId:CASE_ID,selectedComparableIds:ids55,selectionRationales:rationale55,selectedByRef:'V',selectionEvidenceRef:'SEL',selectedAt:select55,minimumSelectedCount:3};
 const a55={caseId:CASE_ID,adjustmentRecords:ids55.map(id=>adj55.createComparableAdjustmentRecord({adjustmentId:'AD-'+id,caseId:CASE_ID,comparableId:id,factor:'LOCATION',direction:'NONE',method:'PERCENT_OF_BASE',magnitude:0,rationale:'SYNTHETIC NO ADJUSTMENT',evidenceRefs:['EVID'],confidence:'HIGH',preparedByRef:'V',preparedAt:select55,reviewedByRef:'R',reviewedAt:review55,reviewEvidenceRef:'REV'}))};
 const gate55=cmp55.evaluateComparableSetQuality({...q55,records:rec55});
 const selection55=adj55.recordProfessionalComparableSelection({...p55,records:rec55,qualityGate:gate55});
 const analysis55=adj55.buildComparableAdjustmentAnalysis({...a55,records:rec55,selection:selection55});
 const landDraft55={...scope54,packetId:'LAND55',propertyEvidencePacket:landProperty55,adjustmentAnalysis:analysis55,comparableRecords:rec55,subjectLandAreaMeasurementId:'M-TITLE',weights:{L1:0.5,L2:0.25,L3:0.25},weightRationales:rationale55,overallReconciliationRationale:'SYNTHETIC',reconciledByRef:'V',reconciledAt:reconcile55,reconciliationEvidenceRef:'RECON',minimumIndicationCount:3};
 const lp55=land55.buildLandSalesComparisonInputPacket(landDraft55),lr55=calculateLandSalesComparisonIndication(lp55);
 const ld55={methodInputDraft:landDraft55,propertyEvidenceDraft:propertyLand55,landMarketSource:{qualityDraft:q55,selectionDraft:p55,adjustmentDraft:a55}};
 const replayLand55={...scope54,asOf:asOf55,methodIndications:[{id:'L',sourceResult:lr55}],methodInputPacketsByIndicationId:{L:lp55},sourceRebuildsByIndicationId:{L:ld55}};
 const landOut55=evaluateSourceInputReplay(replayLand55);check(landOut55.status==='READY_FOR_SOURCE_INPUT_REPLAY_REVIEW',JSON.stringify(landOut55.blockers));check(lr55.landValueIndicationSar===1000000,'land source replay 1m');
 function holdLand55(d){const o=evaluateSourceInputReplay({...replayLand55,sourceRebuildsByIndicationId:{L:d}});check(o.status==='HOLD_SOURCE_INPUT_REPLAY'&&o.traces.length===0,JSON.stringify(o.blockers));}
 holdLand55({...ld55,landMarketSource:{...ld55.landMarketSource,qualityDraft:{...q55,targetCity:'OTHER'}}});
 holdLand55({...ld55,landMarketSource:{...ld55.landMarketSource,adjustmentDraft:{...a55,adjustmentRecords:a55.adjustmentRecords.slice(1)}}});
 holdLand55({...ld55,methodInputDraft:{...landDraft55,comparableRecords:[{...rec55[0],unitValueSarPerSqm:9999},...rec55.slice(1)]}});
 // Actual GFA/SQM from the bridge, with explicit dual-source measurement policy.
 const gfa55=[createMeasurementRecord({measurementId:'M-GFA-PLAN',caseId:CASE_ID,type:MEASUREMENT_TYPE.GFA,valueSqm:1000,source:MEASUREMENT_SOURCE.APPROVED_PLAN,sourceEvidenceRef:'evidence://plan/gfa',measurementStandardRef:'SYNTH-GFA',measurementMethod:'DOCUMENT_REPORTED_AREA',measuredByRef:'V',measuredAt:'2026-09-07T07:00:00Z'}),createMeasurementRecord({measurementId:'M-GFA-INSP',caseId:CASE_ID,inspectionId:INSPECTION_ID,type:MEASUREMENT_TYPE.GFA,valueSqm:1000,source:MEASUREMENT_SOURCE.INSPECTION,sourceEvidenceRef:'evidence://inspection/gfa',measurementStandardRef:'SYNTH-GFA',measurementMethod:'SITE_MEASUREMENT',measuredByRef:'V',measuredAt:'2026-09-07T08:15:00Z'})];
 const all55=[...goodMeasurements,...gfa55],types55=[MEASUREMENT_TYPE.LAND_AREA,MEASUREMENT_TYPE.GFA],tol55={LAND_AREA:{absoluteSqm:2},GFA:{absoluteSqm:0}},min55={LAND_AREA:2,GFA:2};
 const propertyWhole55={...propertyDraft54,inspection:completedInspection(all55,{materialTypes:types55,toleranceByType:tol55,minimumIndependentSourcesByType:min55}),measurementRecords:all55,materialMeasurementTypes:types55,measurementToleranceByType:tol55,minimumMeasurementSourcesByType:min55};
 const wp55=buildPropertyEvidencePacket(propertyWhole55);check(whole55.verifyPropertyEvidencePacketIntegrity(wp55),'modern bridge digest verifies');
 check(!whole55.verifyPropertyEvidencePacketIntegrity({...wp55,measurementGateHashSha256:'0'.repeat(64)}),'modern bridge gate digest tampering rejected');
 const unit55='GROSS_BUILDING_AREA_SQM',marketScope55={marketContextId:'MARKET55',geographyKey:'SYNTHETIC_RIYADH',assetType:'OFFICE'},mid55=['M1','M2','M3'],mr55=Object.fromEntries(mid55.map(id=>[id,'SYNTHETIC REVIEW']));
 const market55={...marketScope55,evidenceRecords:mid55.map((id,i)=>({...marketScope55,id:'E-'+id,evidenceType:'CLOSED_SALE_TRANSACTION',evidenceClass:'AUTHORITATIVE_CLOSED_TRANSACTION',normalizedValue:{amountSar:[2000000,2200000,1800000][i],areaSqm:1000},sourceId:'REGA_REAL_ESTATE_INDICATORS',sourceReference:'SYNTHETIC-'+id,sourceUrl:'https://rei.rega.gov.sa/ar/advanced-search/deals',transactionKey:'SALE-'+id,resolutionMethod:'OFFICIAL_TRANSACTION_RECORD',verificationStatus:'VERIFIED',verifiedBy:'R',verificationReference:'REV-'+id,freshnessPolicyId:'F',effectiveAt:'2026-08-01',observedAt:'2026-08-02',validUntil:'2026-10-01'})),trustedVerifierIds:['R'],governedFreshnessPolicyIds:['F'],minimumCountPolicyId:'MIN',governedMinimumCountPolicies:{MIN:{CLOSED_SALE_TRANSACTION:3}}};
 const wholeDraft55={...scope54,packetId:'WHOLE55',asOf:asOf55,unitOfComparison:unit55,subjectMeasurementId:'M-GFA-PLAN',subjectPropertyEvidencePacket:wp55,marketEvidence:market55,marketContextBinding:{...marketScope55,bindingId:'B',propertyRef:PROPERTY_REF,boundBy:'R',bindingReference:'BIND',boundAt:'2026-09-07T09:10:00Z'},trustedMarketContextBinderIds:['R'],comparableMeasurements:mid55.map(id=>({comparableId:id,transactionKey:'SALE-'+id,sourcePropertyRef:'PROPERTY-'+id,assetType:'OFFICE',unitOfComparison:unit55,basisQuantity:1000,sourceRef:'MEASURE-'+id,effectiveAt:'2026-08-01',validUntil:'2026-10-01',verifiedBy:'R',verificationReference:'REV',verifiedAt:'2026-08-02'})),trustedMeasurementVerifierIds:['R'],selectedComparableIds:mid55,selectionRationales:mr55,selectedBy:'R',selectionReference:'SEL',selectedAt:select55,trustedComparableSelectorIds:['R'],adjustmentRecords:mid55.map(id=>({adjustmentId:'AD-'+id,comparableId:id,factor:'LOCATION',direction:'NONE',method:'PERCENT_OF_BASE',magnitude:0,rationale:'SYNTHETIC NO ADJUSTMENT',evidenceRefs:['EVID'],reviewedBy:'R',reviewReference:'REV',reviewedAt:review55})),trustedAdjustmentReviewerIds:['R'],reconciliationPolicyId:'P',governedReconciliationPolicies:{P:{allowedUnitsOfComparison:[unit55],allowedAssetTypes:['OFFICE'],minimumComparableCount:3,maxMeasurementTransactionDateGapDays:30,maxSingleComparableWeight:0.5,maxSingleAdjustmentPercent:0.2,maxNetAdjustmentPercent:0.25,maxGrossAdjustmentPercent:0.4,maxAdjustedUnitSpreadRatio:0.5,requireAllSelectedWeighted:true,requireAdjustmentDisposition:true}},weightsByComparableId:{M1:0.5,M2:0.25,M3:0.25},weightRationales:mr55,reconciledBy:'R',reconciliationReference:'REC',reconciledAt:reconcile55,trustedReconcilerIds:['R']};
 const wi55=whole55.buildWholePropertySalesComparisonInputPacket(wholeDraft55),wr55=calculateWholePropertySalesComparisonIndication(wi55);
 const wd55={methodInputDraft:wholeDraft55,propertyEvidenceDraft:propertyWhole55};
 const replayWhole55={...scope54,asOf:asOf55,methodIndications:[{id:'W',sourceResult:wr55}],methodInputPacketsByIndicationId:{W:wi55},sourceRebuildsByIndicationId:{W:wd55}};
 const outWhole55=evaluateSourceInputReplay(replayWhole55);check(outWhole55.status==='READY_FOR_SOURCE_INPUT_REPLAY_REVIEW',JSON.stringify({blockers:outWhole55.blockers,input:wi55.blockers}));check(wr55.valueIndicationSar===2000000,'whole property replay 2m');
 check(evaluateSourceInputReplay(JSON.parse(JSON.stringify(replayWhole55))).status==='READY_FOR_SOURCE_INPUT_REPLAY_REVIEW','whole JSON replay');
 function holdWhole55(d){const o=evaluateSourceInputReplay({...replayWhole55,sourceRebuildsByIndicationId:{W:{...wd55,methodInputDraft:d}}});check(o.status==='HOLD_SOURCE_INPUT_REPLAY'&&o.traces.length===0,JSON.stringify(o.blockers));}
 holdWhole55({...wholeDraft55,selectedAt:'2026-09-07T09:00:00Z'});holdWhole55({...wholeDraft55,adjustmentRecords:wholeDraft55.adjustmentRecords.map(x=>({...x,reviewedAt:'2026-09-08'}))});holdWhole55({...wholeDraft55,subjectMeasurementId:'M-TITLE'});holdWhole55({...wholeDraft55,comparableMeasurements:wholeDraft55.comparableMeasurements.map(x=>({...x,basisQuantity:500}))});
 console.log('V655_LAND_WHOLE_SOURCE_REPLAY=PASS synthetic=true sourceAuthority=false');
